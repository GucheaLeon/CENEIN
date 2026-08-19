const path = require('path');
const fs = require('fs');
const forge = require('node-forge');
const soap = require('soap');

const WSAA_HOMO_WSDL = 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?WSDL';
const WSAA_PROD_WSDL = 'https://wsaa.afip.gov.ar/ws/services/LoginCms?WSDL';

const WSFE_HOMO_WSDL = 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL';
const WSFE_PROD_WSDL = 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL';

/**
 * Obtiene la configuración de AFIP desde las variables de entorno o valores por defecto.
 */
function getAfipConfig() {
  const isProduction = String(process.env.AFIP_IS_PRODUCTION || 'false').trim().toLowerCase() === 'true';
  const certPath = process.env.AFIP_CERT_PATH
    ? path.resolve(process.env.AFIP_CERT_PATH)
    : path.join(__dirname, '../certs/homo.crt');
  const keyPath = process.env.AFIP_KEY_PATH
    ? path.resolve(process.env.AFIP_KEY_PATH)
    : path.join(__dirname, '../certs/homo.key');
  const cuit = Number(process.env.AFIP_CUIT || 27279591122);
  const ptoVta = Number(process.env.AFIP_PTO_VTA || 1);

  return {
    isProduction,
    certPath,
    keyPath,
    cuit,
    ptoVta,
    wsaaWsdl: isProduction ? WSAA_PROD_WSDL : WSAA_HOMO_WSDL,
    wsfeWsdl: isProduction ? WSFE_PROD_WSDL : WSFE_HOMO_WSDL
  };
}

/**
 * Verifica si los archivos de certificado y clave privada existen en el sistema.
 */
function verifyCertsExist() {
  const config = getAfipConfig();
  const certExists = fs.existsSync(config.certPath);
  const keyExists = fs.existsSync(config.keyPath);

  return {
    valid: certExists && keyExists,
    certPath: config.certPath,
    keyPath: config.keyPath,
    certExists,
    keyExists,
    config
  };
}

/**
 * Genera el XML TRA (Ticket de Requerimiento de Acceso).
 */function createTraXml(service = 'wsfe') {
  const now = new Date();
  const genTime = new Date(now.getTime() - 10 * 60 * 1000);
  const expTime = new Date(now.getTime() + 10 * 60 * 1000);

  const genIso = genTime.toISOString();
  const expIso = expTime.toISOString();
  const uniqueId = Math.floor(now.getTime() / 1000);

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${genIso}</generationTime>
    <expirationTime>${expIso}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}

/**
 * Firma digitalmente el XML TRA usando PKCS#7 (CMS) con node-forge.
 */
function signTra(traXml, certPem, keyPem) {
  const cert = forge.pki.certificateFromPem(certPem);
  const privateKey = forge.pki.privateKeyFromPem(keyPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(traXml, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      {
        type: forge.pki.oids.contentType,
        value: forge.pki.oids.data
      },
      {
        type: forge.pki.oids.messageDigest
      },
      {
        type: forge.pki.oids.signingTime,
        value: new Date()
      }
    ]
  });

  p7.sign({ recipients: [] });
  const cmsDer = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(cmsDer);
}

// Ticket de acceso generado por WSAA. Se comparte entre reinicios del backend.
const TA_CACHE_FILE = process.env.AFIP_TA_PATH
  ? path.resolve(process.env.AFIP_TA_PATH)
  : path.join(__dirname, '../certs/ta_wsfe.json');

// Backup del TA para recuperar ante pérdida de caché mientras ARCA aún lo considera válido.
const TA_BACKUP_FILE = TA_CACHE_FILE.replace('.json', '.backup.json');

function loadCachedToken(useBackup = false) {
  const file = useBackup ? TA_BACKUP_FILE : TA_CACHE_FILE;
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const token = String(data?.token || '').trim();
      const sign = String(data?.sign || '').trim();
      const exp = new Date(data.expirationTime);
      if (
        token &&
        sign &&
        Number.isFinite(exp.getTime()) &&
        exp > new Date(Date.now() + 5 * 60 * 1000)
      ) {
        return { token, sign, expirationTime: exp.toISOString() };
      }
    }
  } catch (err) { }
  return null;
}

function saveCachedToken(token, sign, expirationTime) {
  try {
    const data = { token, sign, expirationTime: expirationTime.toISOString() };
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(TA_CACHE_FILE, json, 'utf8');
    // Guardar copia de respaldo para recuperar ante pérdida del caché principal.
    fs.writeFileSync(TA_BACKUP_FILE, json, 'utf8');
  } catch (err) { }
}

/**
 * Autentica ante el WSAA de AFIP y devuelve { token, sign }.
 */
async function getAfipAuthToken() {
  const cached = loadCachedToken();
  if (cached) {
    return { token: cached.token, sign: cached.sign };
  }

  const check = verifyCertsExist();
  if (!check.valid) {
    throw new Error('Faltan certificados en src/backend/certs/ (homo.crt y homo.key).');
  }

  const certPem = fs.readFileSync(check.certPath, 'utf8');
  const keyPem = fs.readFileSync(check.keyPath, 'utf8');

  const traXml = createTraXml('wsfe');
  const cmsBase64 = signTra(traXml, certPem, keyPem);
  const client = await soap.createClientAsync(check.config.wsaaWsdl);

  let loginTicketResponseXml;
  try {
    const [result] = await client.loginCmsAsync({ in0: cmsBase64 });
    loginTicketResponseXml = result.loginCmsReturn;
  } catch (wsaaErr) {
    const errStr = String(wsaaErr?.message || wsaaErr);
    // ARCA devuelve alreadyAuthenticated cuando el TA anterior sigue vigente
    // server-side pero fue eliminado del caché local. Intentar recuperar del backup.
    if (errStr.includes('alreadyAuthenticated')) {
      const backup = loadCachedToken(true);
      if (backup) {
        console.warn('[WSAA] alreadyAuthenticated: restaurando TA desde backup.');
        // Restaurar el caché principal desde el backup
        saveCachedToken(backup.token, backup.sign, new Date(backup.expirationTime));
        return { token: backup.token, sign: backup.sign };
      }
      throw new Error(
        'ARCA rechazó la autenticación con alreadyAuthenticated y no hay backup del TA. ' +
        'El TA anterior aún es válido en los servidores de ARCA. ' +
        'Esperá que expire (máx. 12 hs desde la última autenticación) y reiniciá el backend.'
      );
    }
    throw wsaaErr;
  }

  const tokenMatch = loginTicketResponseXml.match(/<token>(.*?)<\/token>/);
  const signMatch = loginTicketResponseXml.match(/<sign>(.*?)<\/sign>/);
  const expMatch = loginTicketResponseXml.match(/<expirationTime>(.*?)<\/expirationTime>/);

  if (!tokenMatch || !signMatch) {
    throw new Error('Respuesta inválida de WSAA AFIP: No se pudo extraer Token o Sign.');
  }

  const token = tokenMatch[1];
  const sign = signMatch[1];
  const expTimeStr = expMatch ? expMatch[1] : null;
  const expirationTime = expTimeStr ? new Date(expTimeStr) : new Date(Date.now() + 11 * 3600 * 1000);

  saveCachedToken(token, sign, expirationTime);

  return { token, sign };
}

/**
 * Construye el bloque Auth que WSFE serializa como XML estándar de ARCA:
 *
 * <Auth>
 *   <Token>...</Token>
 *   <Sign>...</Sign>
 *   <Cuit>...</Cuit>
 * </Auth>
 *
 * No se debe envolver manualmente el token en XML: node-soap genera ese XML
 * al recibir este objeto en FECAESolicitarAsync/FECompUltimoAutorizadoAsync.
 */
function buildWsfeAuth(config, ticket) {
  const token = String(ticket?.token || '').trim();
  const sign = String(ticket?.sign || '').trim();
  const cuit = Number(config?.cuit);

  if (!token || !sign) {
    throw new Error(`El archivo de ticket WSAA no contiene token y sign válidos: ${TA_CACHE_FILE}`);
  }
  if (!Number.isSafeInteger(cuit) || cuit <= 0) {
    throw new Error('AFIP_CUIT no es válido para WSFE.');
  }

  return {
    Token: token,
    Sign: sign,
    Cuit: cuit
  };
}

/**
 * Obtiene el ticket del JSON (o renueva WSAA si está vencido) y lo prepara
 * para cualquier operación WSFE.
 */
async function getWsfeAuth(config = getAfipConfig()) {
  const ticket = await getAfipAuthToken();
  return buildWsfeAuth(config, ticket);
}

/**
 * Retorna cliente SOAP de WSFE.
 */
async function getWsfeClient() {
  const config = getAfipConfig();
  const client = await soap.createClientAsync(config.wsfeWsdl);
  return client;
}

/**
 * Consulta el estado de los servidores de AFIP (FEDummy).
 */
async function getAfipStatus() {
  const client = await getWsfeClient();
  const [result] = await client.FEDummyAsync({});
  return result.FEDummyResult;
}

/**
 * Consulta el último número de comprobante autorizado.
 */
async function getLastVoucherNumber(ptoVta = null, cbteTipo = 6) {
  const config = getAfipConfig();
  const targetPtoVta = ptoVta || config.ptoVta;
  const auth = await getWsfeAuth(config);
  const client = await getWsfeClient();

  const [result] = await client.FECompUltimoAutorizadoAsync({
    Auth: auth,
    PtoVta: targetPtoVta,
    CbteTipo: cbteTipo
  });

  const resData = result.FECompUltimoAutorizadoResult;
  if (resData.Errors && resData.Errors.Err) {
    const errList = Array.isArray(resData.Errors.Err) ? resData.Errors.Err : [resData.Errors.Err];
    const errMsg = errList.map((e) => `[${e.Code}] ${e.Msg}`).join(', ');
    throw new Error(`AFIP Error FECompUltimoAutorizado: ${errMsg}`);
  }

  return {
    ptoVta: targetPtoVta,
    cbteTipo,
    lastVoucher: resData.CbteNro
  };
}

/**
 * Genera la URL del QR de ARCA obligatorio.
 */
function generateArcaQrUrl(voucherInfo) {
  const config = getAfipConfig();
  const qrData = {
    ver: 1,
    fecha: voucherInfo.fecha,
    cuit: config.cuit,
    ptoVta: Number(voucherInfo.ptoVta || config.ptoVta),
    tipoCmp: Number(voucherInfo.cbteTipo),
    nroCmp: Number(voucherInfo.nroCmp),
    importe: Number(voucherInfo.impTotal),
    moneda: voucherInfo.moneda || 'PES',
    ctz: Number(voucherInfo.monCotiz || 1),
    tipoDocRec: Number(voucherInfo.docTipo || 96),
    nroDocRec: Number(voucherInfo.docNro || 0),
    tipoCodAut: 'E',
    codAut: Number(voucherInfo.cae)
  };

  const jsonStr = JSON.stringify(qrData);
  const base64Str = Buffer.from(jsonStr).toString('base64');
  return `https://www.afip.gob.ar/fe/qr/?p=${base64Str}`;
}

/**
 * Autoriza una factura en AFIP y devuelve el CAE.
 */
async function createVoucher(params) {
  const config = getAfipConfig();
  const targetPtoVta = Number(params.ptoVta || config.ptoVta);
  const targetCbteTipo = Number(params.cbteTipo || 6);

  const lastInfo = await getLastVoucherNumber(targetPtoVta, targetCbteTipo);
  const nextCbteNro = lastInfo.lastVoucher + 1;

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const dateFormatted = new Date().toISOString().slice(0, 10);

  const auth = await getWsfeAuth(config);
  const client = await getWsfeClient();

  const reqDetail = {
    Concepto: Number(params.concepto || 1), // 1 = Productos por defecto
    DocTipo: Number(params.docTipo || 96),
    DocNro: Number(params.docNro || 0),
    CondicionIVAReceptorId: Number(params.condicionIVAReceptorId || 5), // 5 = Consumidor Final
    CbteDesde: nextCbteNro,
    CbteHasta: nextCbteNro,
    CbteFch: Number(params.cbteFch || todayStr),
    ImpTotal: Number(params.impTotal),
    ImpTotConc: Number(params.impTotConc || 0),
    ImpNeto: Number(params.impNeto || params.impTotal),
    ImpOpEx: Number(params.impOpEx || 0),
    ImpIVA: Number(params.impIVA || 0),
    ImpTrib: Number(params.impTrib || 0),
    MonId: params.monId || 'PES',
    MonCotiz: Number(params.monCotiz || 1)
  };

  if (reqDetail.Concepto === 2 || reqDetail.Concepto === 3) {
    reqDetail.FchServDesde = Number(params.fchServDesde || todayStr);
    reqDetail.FchServHasta = Number(params.fchServHasta || todayStr);
    reqDetail.FchVtoPago = Number(params.fchVtoPago || todayStr);
  }

  // Para Factura B (6) o Factura A (1), calcular IVA 21% si no se especifica desglosado
  if (targetCbteTipo === 6 || targetCbteTipo === 1) {
    if (params.ivaArray) {
      reqDetail.Iva = { AlicIva: params.ivaArray };
    } else if (Number(params.impTotal) > 0) {
      const impNeto = Number((params.impTotal / 1.21).toFixed(2));
      const impIva = Number((params.impTotal - impNeto).toFixed(2));
      reqDetail.ImpNeto = impNeto;
      reqDetail.ImpIVA = impIva;
      reqDetail.Iva = {
        AlicIva: [
          {
            Id: 5, // 5 = 21%
            BaseImp: impNeto,
            Importe: impIva
          }
        ]
      };
    }
  }

  const feCAEReq = {
    FeCabReq: {
      CantReg: 1,
      PtoVta: targetPtoVta,
      CbteTipo: targetCbteTipo
    },
    FeDetReq: {
      FECAEDetRequest: [reqDetail]
    }
  };

  const [result] = await client.FECAESolicitarAsync({
    Auth: auth,
    FeCAEReq: feCAEReq
  });

  const resData = result.FECAESolicitarResult;
  if (resData.Errors && resData.Errors.Err) {
    const errList = Array.isArray(resData.Errors.Err) ? resData.Errors.Err : [resData.Errors.Err];
    const errMsg = errList.map((e) => `[${e.Code}] ${e.Msg}`).join(', ');
    throw new Error(`AFIP Error FECAESolicitar: ${errMsg}`);
  }

  const detRes = resData.FeDetResp.FECAEDetResponse[0];

  if (detRes.Resultado === 'R') {
    const obsList = detRes.Observaciones && detRes.Observaciones.Obs
      ? (Array.isArray(detRes.Observaciones.Obs) ? detRes.Observaciones.Obs : [detRes.Observaciones.Obs])
      : [];
    const obsMsg = obsList.map((o) => `[${o.Code}] ${o.Msg}`).join(', ');
    throw new Error(`AFIP Factura Rechazada: ${obsMsg}`);
  }

  const qrUrl = generateArcaQrUrl({
    fecha: dateFormatted,
    ptoVta: targetPtoVta,
    cbteTipo: targetCbteTipo,
    nroCmp: nextCbteNro,
    impTotal: params.impTotal,
    moneda: params.monId || 'PES',
    monCotiz: params.monCotiz || 1,
    docTipo: params.docTipo || 96,
    docNro: params.docNro || 0,
    cae: detRes.CAE
  });

  return {
    cae: detRes.CAE,
    caeVto: detRes.CAEFchVto || detRes.CAEVto,
    ptoVta: targetPtoVta,
    cbteTipo: targetCbteTipo,
    cbteNro: nextCbteNro,
    fechaEmision: dateFormatted,
    impTotal: params.impTotal,
    qrUrl,
    resultado: detRes.Resultado
  };
}

module.exports = {
  getAfipConfig,
  verifyCertsExist,
  getAfipStatus,
  getAfipAuthToken,
  getWsfeAuth,
  getLastVoucherNumber,
  generateArcaQrUrl,
  createVoucher
};
