🚜 CRUCI TRACK - Sistema de Monitoreo de Red
CRUCI TRACK es una plataforma industrial de control y gestión para la red de concesionarios de Crucianelli. Permite el seguimiento en tiempo real de la actividad telefónica, la gestión centralizada de terminales y la visualización de indicadores de rendimiento (KPIs).

🛠️ Stack Tecnológico
Frontend: Next.js 13.5.6 (App Router).

Estilos: Tailwind CSS (Diseño con estética industrial Dark).

Backend & Base de Datos: Supabase (PostgreSQL).

Realtime: PostgreSQL CDC para actualizaciones instantáneas sin recargar la página.

Iconografía: Lucide React.

🚀 Funcionalidades Implementadas
1. Dashboard en Tiempo Real
Visualización de las últimas 100 llamadas (Entrantes/Salientes).

KPIs dinámicos: Volumen de Red, Tasa de Eficiencia (Atendidas) e Incidencias (Perdidas).

Filtros avanzados por fecha y por número de puesto (Dispositivo ID).

Identificación inmediata de concesionarios vinculados.

2. Agenda de Red (Multi-línea)
Gestión Centralizada: Sección dedicada para administrar la base de datos de concesionarios.

Soporte Multivendedor: Capacidad de asociar múltiples números de teléfono a un mismo concesionario.

Vinculación Retroactiva: Al asignar un número a un concesionario, el sistema actualiza automáticamente todo el historial de llamadas de ese número.

3. Automatización Inteligente (SQL Triggers)
tr_vincular_por_agenda_completa: Función a nivel de base de datos que identifica al concesionario en el momento exacto en que ingresa la llamada.

tr_limpiar_historial_numero: Trigger que asegura que, al agregar un nuevo vendedor a la agenda, todas sus llamadas pasadas se identifiquen correctamente en el dashboard.

📊 Modelo de Datos
El sistema utiliza tres tablas principales interconectadas:

llamadas: Registro de eventos (sentido, número, estado, dispositivo, fecha).

concesionarios: Entidades de la red (nombre, localidad).

concesionario_telefonos: Diccionario de números asociados a cada concesionario.

⚙️ Configuración del Entorno
Clonar el repositorio:

Bash
git clone https://github.com/rekoasef/sistemaLlamadas.git
Instalar dependencias:

Bash
npm install
Variables de Entorno (.env.local):

Fragmento de código
NEXT_PUBLIC_SUPABASE_URL=tu_proyecto_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
Levantar el proyecto:

Bash
npm run dev
📝 Scripts de Base de Datos (SQL Editor)
Para el correcto funcionamiento de la automatización, es necesario ejecutar los scripts de la carpeta /sql (o los triggers de vinculación automática) en el panel de Supabase para habilitar la lógica SECURITY DEFINER que permite la actualización cruzada de tablas.

🗺️ Roadmap
[x] Gestión Multi-línea.

[x] Triggers de vinculación retroactiva.

[x] Inteligencia BI: Módulo de analítica avanzada y reportes semanales.

[ ] Exportación: Reportes en PDF de rendimiento por terminal.

Desarrollado para Crucianelli S.A.
Optimizando la comunicación de la red líder en maquinaria agrícola.