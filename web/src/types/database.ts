export interface Llamada {
  id: string;
  numero_telefono: string;
  tipo_llamada: 'ENTRANTE' | 'SALIENTE';
  duracion_segundos: number;
  dispositivo_id: string;
  estado: 'ATENDIDA' | 'PERDIDA';
  fecha_llamada: string; // timestamptz
  concesionario_id?: string | null;
}

export interface Concesionario {
  id: string;
  nombre: string;
  localidad: string;
  telefonos: string[];
}