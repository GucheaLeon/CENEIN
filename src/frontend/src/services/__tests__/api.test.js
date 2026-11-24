import {
  obtenerToken,
  guardarToken,
  limpiarToken,
  iniciarSesionApi,
  obtenerPacientesApi,
} from '../api';

describe('Servicio de API Frontend y Manejo de Errores (Failed to Fetch)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    jest.restoreAllMocks();
  });

  describe('Gestión de Token JWT en Storage', () => {
    it('debe guardar y obtener token en sessionStorage por defecto', () => {
      guardarToken('jwt-token-123', false);
      expect(obtenerToken()).toBe('jwt-token-123');
      expect(window.sessionStorage.getItem('cenein_token')).toBe('jwt-token-123');
      expect(window.localStorage.getItem('cenein_token')).toBeNull();
    });

    it('debe guardar token en localStorage cuando recordarSesion es true', () => {
      guardarToken('jwt-token-permanente', true);
      expect(obtenerToken()).toBe('jwt-token-permanente');
      expect(window.localStorage.getItem('cenein_token')).toBe('jwt-token-permanente');
    });

    it('debe limpiar el token correctamente de ambos almacenamientos', () => {
      guardarToken('token-a-borrar', true);
      limpiarToken();
      expect(obtenerToken()).toBe('');
      expect(window.localStorage.getItem('cenein_token')).toBeNull();
      expect(window.sessionStorage.getItem('cenein_token')).toBeNull();
    });
  });

  describe('Manejo de Errores de Red y "Failed to fetch"', () => {
    it('debe capturar TypeError: Failed to fetch cuando el servidor backend está inaccesible', async () => {
      // Simulamos la caída del backend o fallo de red
      const mockFetch = jest.spyOn(global, 'fetch').mockImplementation(() =>
        Promise.reject(new TypeError('Failed to fetch'))
      );

      await expect(
        iniciarSesionApi({ username: 'admin', password: 'password123' })
      ).rejects.toThrow('Failed to fetch');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('debe procesar respuestas exitosas de la API', async () => {
      const mockResponse = {
        token: 'fake-jwt-token-xyz',
        user: { id: 1, username: 'admin', isAdmin: true }
      };

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const data = await iniciarSesionApi({ username: 'admin', password: 'password123' });
      expect(data.token).toBe('fake-jwt-token-xyz');
      expect(obtenerToken()).toBe('fake-jwt-token-xyz');
    });

    it('debe extraer el mensaje de error del backend en respuestas HTTP 400/401/500', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Credenciales inválidas' }),
      });

      await expect(
        iniciarSesionApi({ username: 'admin', password: 'wrongpassword' })
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('debe adjuntar automáticamente el encabezado Authorization cuando existe un token guardado', async () => {
      guardarToken('token-guardado-123');

      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, first_name: 'Juan' }],
      });

      await obtenerPacientesApi();

      expect(mockFetch).toHaveBeenCalled();
      const llamadas = mockFetch.mock.calls[0];
      const headers = llamadas[1].headers;
      expect(headers.get('Authorization')).toBe('Bearer token-guardado-123');
    });
  });
});
