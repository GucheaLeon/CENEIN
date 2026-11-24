const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

require('dotenv').config({
    path: path.join(__dirname, '..', '.env')
});

const { Pool } = require('pg');

console.log(
    'DATABASE_URL configurada:',
    Boolean(process.env.DATABASE_URL)
);

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4000';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function login() {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: 'admin',
            password: 'admin1234'
        })
    });

    const body = await response.json();

    console.log('Respuesta del login:', response.status, body);

    assert.equal(
        response.status,
        200,
        'El login del usuario de prueba debería funcionar'
    );

    assert.ok(
        body.token,
        'El login debería devolver un token'
    );

    return body.token;
}

test('POST /api/admisiones crea una admisión', async () => {
    const token = await login();

    const dni = `9${Date.now().toString().slice(-7)}`;

    const admision = {
        nombre: 'Test',
        apellido: 'Integracion',
        dni,
        fechaNacimiento: '2015-05-10',
        telefono: '3515551234',
        domicilio: 'Domicilio de prueba',
        tieneObraSocial: false
    };

    const response = await fetch(`${BASE_URL}/api/admisiones`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(admision)
    });

    const body = await response.json();

    console.log('POST /api/admisiones:', response.status, body);

    // 1. Comprobamos la respuesta HTTP
    assert.equal(response.status, 201);

    // 2. Comprobamos que la API devolvió los datos esperados
    assert.ok(body.id);

    assert.equal(body.nombre, admision.nombre);
    assert.equal(body.apellido, admision.apellido);
    assert.equal(body.dni, admision.dni);
    assert.equal(body.telefono, admision.telefono);
    assert.equal(body.domicilio, admision.domicilio);
    assert.equal(body.tieneObraSocial, admision.tieneObraSocial);

    // 3. Buscamos esa misma admisión directamente en PostgreSQL
    const result = await pool.query(
        `
        SELECT *
        FROM admissions
        WHERE id = $1
        `,
        [body.id]
    );

    // 4. Comprobamos que realmente fue almacenada
    assert.equal(
        result.rows.length,
        1,
        'La admisión creada por el endpoint debería existir en PostgreSQL'
    );

    const admisionBD = result.rows[0];

    console.log(
        'Registro encontrado en PostgreSQL:',
        admisionBD
    );

    // 5. Comprobamos los datos almacenados en PostgreSQL
    assert.equal(admisionBD.first_name, admision.nombre);
    assert.equal(admisionBD.last_name, admision.apellido);
    assert.equal(admisionBD.dni, admision.dni);
    assert.equal(admisionBD.phone, admision.telefono);
    assert.equal(admisionBD.address, admision.domicilio);
    assert.equal(
        admisionBD.tiene_obra_social,
        admision.tieneObraSocial
    );

    assert.equal(
        admisionBD.tiene_cud,
        false
    );

    assert.equal(
        admisionBD.obra_social_nombre,
        null
    );

    const fechaNacimientoBD = admisionBD.birth_date;

    const fechaEsperada = new Date(
        `${admision.fechaNacimiento}T00:00:00.000Z`
    );

    assert.equal(
        fechaNacimientoBD.getUTCFullYear(),
        fechaEsperada.getUTCFullYear()
    );

    assert.equal(
        fechaNacimientoBD.getUTCMonth(),
        fechaEsperada.getUTCMonth()
    );

    assert.equal(
        fechaNacimientoBD.getUTCDate(),
        fechaEsperada.getUTCDate()
    );

    console.log('Registro encontrado en PostgreSQL:', admisionBD);

    // 6. Limpiar el registro creado por la prueba
    await pool.query(
        `DELETE FROM admissions WHERE id = $1`,
        [body.id]
    );

    console.log('Comprobando eliminación...');

    const eliminado = await pool.query(
        `SELECT id FROM admissions WHERE id = $1`,
        [body.id]
    );

    console.log('Resultado después del DELETE:', eliminado.rows);

    assert.equal(
        eliminado.rows.length,
        0,
        'La admisión de prueba debería eliminarse al finalizar el test'
    );
});
test('POST /api/admisiones rechaza paciente menor de 3 años', async () => {
    const token = await login();

    const dni = `8${Date.now().toString().slice(-7)}`;

    const admisionInvalida = {
        nombre: 'Test',
        apellido: 'Menor',
        dni,
        fechaNacimiento: '2025-05-10',
        telefono: '3515551234',
        domicilio: 'Domicilio de prueba',
        tieneObraSocial: false
    };

    const response = await fetch(`${BASE_URL}/api/admisiones`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(admisionInvalida)
    });

    const body = await response.json();

    console.log(
        'POST inválido /api/admisiones:',
        response.status,
        body
    );

    assert.equal(
        response.status,
        400,
        'El endpoint debería rechazar un paciente menor de 3 años'
    );

    assert.match(
        body.error,
        /menos de 3 años/i,
        'El backend debería informar que el paciente tiene menos de 3 años'
    );

    const result = await pool.query(
        `
        SELECT id
        FROM admissions
        WHERE dni = $1
        `,
        [dni]
    );

    assert.equal(
        result.rows.length,
        0,
        'Una admisión rechazada no debería existir en PostgreSQL'
    );
});
test('POST /api/admisiones rechaza paciente mayor de 18 años', async () => {
    const token = await login();

    const dni = `7${Date.now().toString().slice(-7)}`;

    const admision = {
        nombre: 'Test',
        apellido: 'Mayor',
        dni,
        fechaNacimiento: '2000-05-10',
        telefono: '3515551234',
        domicilio: 'Domicilio de prueba',
        tieneObraSocial: false
    };

    const response = await fetch(`${BASE_URL}/api/admisiones`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(admision)
    });

    const body = await response.json();

    console.log('Paciente mayor de 18:', response.status, body);

    assert.equal(response.status, 400);

    assert.match(
        body.error,
        /18 años/i
    );

    const result = await pool.query(
        'SELECT id FROM admissions WHERE dni = $1',
        [dni]
    );

    assert.equal(
        result.rows.length,
        0,
        'El paciente rechazado no debería guardarse'
    );
});


test('POST /api/admisiones rechaza nombre faltante', async () => {
    const token = await login();

    const dni = `7${Date.now().toString().slice(-7)}`;

    try {
        const admision = {
            apellido: 'SinNombre',
            dni,
            fechaNacimiento: '2015-05-10',
            telefono: '3515551234',
            domicilio: 'Domicilio de prueba',
            tieneObraSocial: false
        };

        const response = await fetch(`${BASE_URL}/api/admisiones`, {
            method: 'POST', headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(admision)
        });

        const body = await response.json();

        console.log('Nombre faltante:', response.status, body);

        assert.equal(response.status, 400);

        assert.ok(body.error, 'La API debería devolver un mensaje de error');

        const result = await pool.query('SELECT id FROM admissions WHERE dni = $1', [dni]);

        assert.equal(result.rows.length, 0, 'La admisión inválida no debería guardarse');

    } finally {
        await pool.query('DELETE FROM admissions WHERE dni = $1', [dni]);
    }
});

test('POST /api/admisiones rechaza apellido faltante', async () => {
    const token = await login();

    const dni = `7${Date.now().toString().slice(-7)}`;

    try {
        const admision = {
            nombre: 'SinApellido',
            dni,
            fechaNacimiento: '2015-05-10',
            telefono: '3515551234',
            domicilio: 'Domicilio de prueba',
            tieneObraSocial: false
        };

        const response = await fetch(`${BASE_URL}/api/admisiones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(admision)
        });

        const body = await response.json();

        console.log('Apellido faltante:', response.status, body);

        assert.equal(response.status, 400);

        assert.ok(
            body.error,
            'La API debería devolver un mensaje de error'
        );

        const result = await pool.query(
            'SELECT id FROM admissions WHERE dni = $1',
            [dni]
        );

        assert.equal(
            result.rows.length,
            0,
            'La admisión inválida no debería guardarse'
        );
    } finally {
        await pool.query(
            'DELETE FROM admissions WHERE dni = $1',
            [dni]
        );
    }
});

test('POST /api/admisiones rechaza DNI inválido', async () => {
    const token = await login();

    const dni = 'ABC123';

    try {
        const admision = {
            nombre: 'Test',
            apellido: 'DNIInvalido',
            dni,
            fechaNacimiento: '2015-05-10',
            telefono: '3515551234',
            domicilio: 'Domicilio de prueba',
            tieneObraSocial: false
        };

        const response = await fetch(`${BASE_URL}/api/admisiones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(admision)
        });

        const body = await response.json();

        console.log('DNI inválido:', response.status, body);

        assert.equal(response.status, 400);
        assert.ok(body.error);

        const result = await pool.query(
            'SELECT id FROM admissions WHERE dni = $1',
            [dni]
        );

        assert.equal(
            result.rows.length,
            0,
            'No debería guardarse un DNI inválido'
        );
    } finally {
        await pool.query(
            'DELETE FROM admissions WHERE dni = $1',
            [dni]
        );
    }
});


test('POST /api/admisiones rechaza fecha de nacimiento futura', async () => {
    const token = await login();

    const dni = `7${Date.now().toString().slice(-7)}`;

    try {
        const admision = {
            nombre: 'Test',
            apellido: 'FechaFutura',
            dni,
            fechaNacimiento: '2030-05-10',
            telefono: '3515551234',
            domicilio: 'Domicilio de prueba',
            tieneObraSocial: false
        };

        const response = await fetch(`${BASE_URL}/api/admisiones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(admision)
        });

        const body = await response.json();

        console.log('Fecha futura:', response.status, body);

        assert.equal(response.status, 400);
        assert.ok(body.error);

        const result = await pool.query(
            'SELECT id FROM admissions WHERE dni = $1',
            [dni]
        );

        assert.equal(result.rows.length, 0);

    } finally {
        await pool.query(
            'DELETE FROM admissions WHERE dni = $1',
            [dni]
        );
    }
});

test('POST /api/admisiones rechaza obra social sin nombre', async () => {
    const token = await login();

    const dni = `7${Date.now().toString().slice(-7)}`;

    try {
        const admision = {
            nombre: 'Test',
            apellido: 'SinObraSocial',
            dni,
            fechaNacimiento: '2015-05-10',
            telefono: '3515551234',
            domicilio: 'Domicilio de prueba',
            tieneObraSocial: true
        };

        const response = await fetch(`${BASE_URL}/api/admisiones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(admision)
        });

        const body = await response.json();

        console.log(
            'Obra social sin nombre:',
            response.status,
            body
        );

        assert.equal(
            response.status,
            400,
            'La API debería rechazar una obra social sin nombre'
        );

        assert.ok(
            body.error,
            'La API debería devolver un mensaje de error'
        );

        const result = await pool.query(
            'SELECT id FROM admissions WHERE dni = $1',
            [dni]
        );

        assert.equal(
            result.rows.length,
            0,
            'No debería guardarse la admisión inválida'
        );
    } finally {
        await pool.query(
            'DELETE FROM admissions WHERE dni = $1',
            [dni]
        );
    }
});

test('POST /api/admisiones rechaza solicitud sin autenticación', async () => {
    const dni = `7${Date.now().toString().slice(-7)}`;

    try {
        const admision = {
            nombre: 'Test',
            apellido: 'SinAuth',
            dni,
            fechaNacimiento: '2015-05-10',
            telefono: '3515551234',
            domicilio: 'Domicilio de prueba',
            tieneObraSocial: false
        };

        const response = await fetch(`${BASE_URL}/api/admisiones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(admision)
        });

        const body = await response.json();

        console.log(
            'Sin autenticación:',
            response.status,
            body
        );

        assert.equal(
            response.status,
            401,
            'Una solicitud sin autenticación debería ser rechazada'
        );

        const result = await pool.query(
            'SELECT id FROM admissions WHERE dni = $1',
            [dni]
        );

        assert.equal(
            result.rows.length,
            0,
            'Una solicitud sin autenticación no debería crear una admisión'
        );
    } finally {
        await pool.query(
            'DELETE FROM admissions WHERE dni = $1',
            [dni]
        );
    }
});

test('POST /api/admisiones rechaza DNI duplicado', async () => {
    const token = await login();

    const dni = `8${Date.now().toString().slice(-7)}`;

    try {
        const admision = {
            nombre: 'Primero',
            apellido: 'Duplicado',
            dni,
            fechaNacimiento: '2015-05-10',
            telefono: '3515551234',
            domicilio: 'Domicilio de prueba',
            tieneObraSocial: false
        };

        // Primera admisión
        const primeraResponse = await fetch(`${BASE_URL}/api/admisiones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(admision)
        });

        const primeraBody = await primeraResponse.json();

        console.log(
            'Primera admisión:',
            primeraResponse.status,
            primeraBody
        );

        assert.equal(
            primeraResponse.status,
            201,
            'La primera admisión debería crearse correctamente'
        );

        // Segunda admisión con el mismo DNI
        const segundaResponse = await fetch(`${BASE_URL}/api/admisiones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                ...admision,
                nombre: 'Segundo'
            })
        });

        const segundaBody = await segundaResponse.json();

        console.log(
            'Segunda admisión con DNI duplicado:',
            segundaResponse.status,
            segundaBody
        );

        assert.notEqual(
            segundaResponse.status,
            201,
            'No debería permitir crear una segunda admisión con el mismo DNI'
        );

        // Verificar directamente PostgreSQL
        const result = await pool.query(
            `
            SELECT *
            FROM admissions
            WHERE dni = $1
            `,
            [dni]
        );

        console.log(
            'Registros encontrados con ese DNI:',
            result.rows
        );

        assert.equal(
            result.rows.length,
            1,
            'Debería existir solamente una admisión con ese DNI'
        );
    } finally {
        await pool.query(
            'DELETE FROM admissions WHERE dni = $1',
            [dni]
        );
    }
});
test('POST /api/admisiones/:id/revision registra una revisión aprobada y actualiza el estado', async () => {
    const token = await login();

    const dni = `7${Date.now().toString().slice(-7)}`;

    // 1. Crear admisión
    try {
        const admisionResponse = await fetch(`${BASE_URL}/api/admisiones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                nombre: 'Revision',
                apellido: 'Fisiatra',
                dni,
                fechaNacimiento: '2015-05-10',
                telefono: '3515551234',
                domicilio: 'Domicilio de prueba',
                tieneObraSocial: false
            })
        });

        const admision = await admisionResponse.json();

        assert.equal(admisionResponse.status, 201);
        assert.ok(admision.id);

        // 2. Registrar revisión
        const revisionResponse = await fetch(
            `${BASE_URL}/api/admisiones/${admision.id}/revision`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    fechaTurno: '2026-09-15',
                    resultado: 'aprobado',
                    devolucion: 'Apto para continuar con el proceso de admisión.'
                })
            }
        );

        const revision = await revisionResponse.json();

        console.log(
            'POST revisión fisiátrica:',
            revisionResponse.status,
            revision
        );

        assert.equal(revisionResponse.status, 201);

        assert.equal(
            revision.admissionId,
            String(admision.id)
        );

        assert.equal(
            revision.resultado,
            'aprobado'
        );

        assert.equal(
            revision.devolucion,
            'Apto para continuar con el proceso de admisión.'
        );

        // 3. Comprobar la revisión directamente en PostgreSQL
        const revisionBD = await pool.query(
            `
            SELECT *
            FROM admission_fisiatric_review
            WHERE admission_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [admision.id]
        );

        assert.equal(
            revisionBD.rows.length,
            1,
            'La revisión debería existir en PostgreSQL'
        );

        assert.equal(
            revisionBD.rows[0].resultado,
            'aprobado'
        );

        assert.equal(
            revisionBD.rows[0].devolucion,
            'Apto para continuar con el proceso de admisión.'
        );

        // 4. Comprobar que la admisión cambió a aprobada
        const admisionBD = await pool.query(
            `
            SELECT estado
            FROM admissions
            WHERE id = $1
            `,
            [admision.id]
        );

        assert.equal(
            admisionBD.rows.length,
            1
        );

        assert.equal(
            admisionBD.rows[0].estado,
            'aprobado',
            'La admisión debería pasar a estado aprobado'
        );
    } finally {
        // Limpieza
        await pool.query(
            `DELETE FROM admission_fisiatric_review WHERE admission_id = $1`,
            [admision.id]
        );

        await pool.query(
            `DELETE FROM admissions WHERE id = $1`,
            [admision.id]
        );
    }
});

test('POST /api/admisiones/:id/revision rechaza un resultado inválido', async () => {
    const token = await login();

    const dni = `6${Date.now().toString().slice(-7)}`;

    try {
        const admisionResponse = await fetch(`${BASE_URL}/api/admisiones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                nombre: 'Revision',
                apellido: 'Invalida',
                dni,
                fechaNacimiento: '2015-05-10',
                telefono: '3515551234',
                domicilio: 'Domicilio de prueba',
                tieneObraSocial: false
            })
        });

        const admision = await admisionResponse.json();

        assert.equal(admisionResponse.status, 201);

        const response = await fetch(
            `${BASE_URL}/api/admisiones/${admision.id}/revision`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    fechaTurno: '2026-09-15',
                    resultado: 'pendiente',
                    devolucion: 'Resultado inválido'
                })
            }
        );

        const body = await response.json();

        console.log(
            'Revisión inválida:',
            response.status,
            body
        );

        assert.equal(response.status, 400);

        assert.match(
            body.error,
            /resultado debe ser/i
        );

        // La revisión NO debería haberse creado
        const revisionBD = await pool.query(
            `
            SELECT id
            FROM admission_fisiatric_review
            WHERE admission_id = $1
            `,
            [admision.id]
        );

        assert.equal(
            revisionBD.rows.length,
            0,
            'No debería existir una revisión con resultado inválido'
        );

        // La admisión tampoco debería haber cambiado
        const admisionBD = await pool.query(
            `
            SELECT estado
            FROM admissions
            WHERE id = $1
            `,
            [admision.id]
        );

        assert.equal(
            admisionBD.rows[0].estado,
            'pendiente_turno'
        );
    } finally {
        await pool.query(
            `DELETE FROM admission_fisiatric_review WHERE admission_id = $1`,
            [admision.id]
        );

        await pool.query(
            `DELETE FROM admissions WHERE id = $1`,
            [admision.id]
        );
    }
});
test('POST /api/admisiones/:id/expediente rechaza expediente antes de aprobar la admisión', async () => {
    const token = await login();

    const dni = `5${Date.now().toString().slice(-7)}`;

    try {
        const admisionResponse = await fetch(`${BASE_URL}/api/admisiones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                nombre: 'Expediente',
                apellido: 'SinAprobacion',
                dni,
                fechaNacimiento: '2015-05-10',
                telefono: '3515551234',
                domicilio: 'Domicilio de prueba',
                tieneObraSocial: false
            })
        });

        const admision = await admisionResponse.json();

        assert.equal(admisionResponse.status, 201);

        const form = new FormData();

        form.append(
            'dniNumero',
            dni
        );

        form.append(
            'numeroAfiliado',
            'AF-TEST-001'
        );

        const pdf = new Blob(
            [Buffer.from('%PDF-TEST%')],
            { type: 'application/pdf' }
        );

        form.append(
            'carnet_pdf',
            pdf,
            'carnet-prueba.pdf'
        );

        const response = await fetch(
            `${BASE_URL}/api/admisiones/${admision.id}/expediente`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: form
            }
        );

        const body = await response.json();

        console.log(
            'Expediente sin aprobación:',
            response.status,
            body
        );

        assert.equal(
            response.status,
            400
        );

        assert.match(
            body.error,
            /debe estar aprobada/i
        );
    } finally {
        await pool.query(
            `DELETE FROM admission_fisiatric_review WHERE admission_id = $1`,
            [admision.id]
        );

        await pool.query(
            `DELETE FROM admissions WHERE id = $1`,
            [admision.id]
        );
    }
});
