export interface TutorialStep {
  id: string
  title: string
  description: string
  target?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  route?: string
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: '¡Bienvenido a Turnoalcorte!',
    description:
      'En este tutorial vas a conocer las funciones principales del sistema. Podés saltar el tutorial en cualquier momento.',
  },
  {
    id: 'today',
    title: 'Vista de hoy',
    description:
      'Acá ves todos los turnos del día. Podés cambiar el estado de cada turno con un clic.',
    target: '[data-tour="today-list"]',
    position: 'bottom',
    route: '/app/today',
  },
  {
    id: 'new-appointment',
    title: 'Nuevo turno',
    description:
      'Usá el botón "Agregar turno" o el atajo ⌘K para crear un turno rápidamente.',
    target: '[data-tour="add-appointment-btn"]',
    position: 'bottom',
    route: '/app/today',
  },
  {
    id: 'calendar',
    title: 'Calendario',
    description:
      'El calendario muestra los turnos de la semana por barbero. Podés arrastrar los turnos para reprogramarlos.',
    target: '[data-tour="calendar-grid"]',
    position: 'bottom',
    route: '/app/calendar',
  },
  {
    id: 'command',
    title: 'Búsqueda rápida',
    description:
      'Presioná Ctrl+K (o ⌘K en Mac) para abrir el buscador. Podés buscar clientes, navegar y ejecutar acciones.',
    target: '[data-tour="search-btn"]',
    position: 'bottom',
  },
  {
    id: 'done',
    title: '¡Listo!',
    description:
      'Ya conocés lo básico. Podés volver a ver este tutorial desde Configuración → Tutorial.',
  },
]
