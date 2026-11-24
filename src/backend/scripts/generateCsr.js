const path = require('path');
const fs = require('fs');
const forge = require('node-forge');

function generateCsr(cuit = '20123456789', organization = 'CENEIN', commonName = 'cenein_homo') {
  const cleanCuit = String(cuit).replace(/\D/g, '');
  console.log(`\nGenerando Clave Privada y Solicitud CSR (PKCS#10) para CUIT ${cleanCuit}...`);

  // 1. Generar par de llaves RSA 2048
  const keys = forge.pki.rsa.generateKeyPair(2048);

  // 2. Crear solicitud CSR (PKCS#10)
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([
    { name: 'countryName', value: 'AR' },
    { name: 'organizationName', value: organization },
    { name: 'commonName', value: commonName },
    { name: 'serialNumber', value: `CUIT ${cleanCuit}` }
  ]);

  // Firmar la solicitud CSR con SHA256 y la clave privada
  csr.sign(keys.privateKey, forge.md.sha256.create());

  // Convertir a formato PEM
  const pemKey = forge.pki.privateKeyToPem(keys.privateKey);
  const pemCsr = forge.pki.certificationRequestToPem(csr);

  const certsDir = path.join(__dirname, '../certs');
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }

  const keyPath = path.join(certsDir, 'homo.key');
  const csrPath = path.join(certsDir, 'homo.csr');

  fs.writeFileSync(keyPath, pemKey, 'utf8');
  fs.writeFileSync(csrPath, pemCsr, 'utf8');

  console.log('✅ Archivo homo.key creado en:', keyPath);
  console.log('✅ Archivo homo.csr creado en:', csrPath);
  console.log('\n======================================================================');
  console.log(' COPIA Y PEGA EL SIGUIENTE TEXTO EN ARCA (FORMATO PKCS#10):');
  console.log('======================================================================\n');
  console.log(pemCsr);
  console.log('======================================================================\n');
}

const cuitArg = process.argv[2] || process.env.AFIP_CUIT || '20123456789';
generateCsr(cuitArg);
