const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { verifyCertsExist, getAfipStatus, getLastVoucherNumber } = require('../services/afipService');

async function testConnection() {
  console.log('=== VERIFICADOR DE CONEXIÓN ARCA / AFIP (HOMOLOGACIÓN) ===\n');

  const check = verifyCertsExist();
  console.log('1. Configuración de credenciales local:');
  console.log(` - CUIT: ${check.config.cuit}`);
  console.log(` - Punto de Venta: ${check.config.ptoVta}`);
  console.log(` - Entorno: ${check.config.isProduction ? 'PRODUCCIÓN' : 'HOMOLOGACIÓN (PRUEBAS)'}`);
  console.log(` - Certificado (.crt): ${check.certPath} -> [${check.certExists ? 'ENCONTRADO OK' : 'NO ENCONTRADO'}]`);
  console.log(` - Clave Privada (.key): ${check.keyPath} -> [${check.keyExists ? 'ENCONTRADA OK' : 'NO ENCONTRADA'}]\n`);

  if (!check.valid) {
    console.log('⚠️ INSTRUCCIONES PARA CONTINUAR:');
    console.log('Coloque los archivos "homo.crt" y "homo.key" en la carpeta:');
    console.log(` -> ${path.join(__dirname, '../certs/')}`);
    console.log('O configure AFIP_CERT_PATH y AFIP_KEY_PATH en el archivo .env.\n');
    process.exit(0);
  }

  console.log('2. Probando autenticación WSAA y consulta de estado con ARCA...');
  try {
    const status = await getAfipStatus();
    console.log(' ✅ Conexión con ARCA exitosa!');
    console.log('   Estado Servidor App:', status.AppServer);
    console.log('   Estado Servidor DB:', status.DbServer);
    console.log('   Estado Servidor Auth:', status.AuthServer);
    console.log('');

    console.log(`3. Consultando último comprobante para Punto de Venta ${check.config.ptoVta}...`);
    const lastVoucher = await getLastVoucherNumber(check.config.ptoVta, 6); // Factura B
    console.log(` ✅ Último número de Factura B autorizado: ${lastVoucher.lastVoucher}`);
    console.log(`    El próximo número a emitir será: ${lastVoucher.lastVoucher + 1}\n`);

    console.log('🎉 TODO LISTO: El módulo está preparado para emitir facturas de prueba en Homologación.');
  } catch (err) {
    console.error('❌ Error durante la conexión con ARCA:');
    if (err.response) {
      console.error(' Status:', err.response.status);
      console.error(' Data:', err.response.data);
    } else {
      console.error(err);
    }
  }
}

testConnection();
