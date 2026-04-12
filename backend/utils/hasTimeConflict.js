/*export function hasTimeConflict(
  newStart,
  newEnd,
  appointments,
  excludeId = null
) {
  const newStartDate = new Date(`1970-01-01T${newStart}:00`)
  const newEndDate = new Date(`1970-01-01T${newEnd}:00`)

  return appointments.some(a => {
    if (excludeId && a.id === excludeId) return false

    const existingStart = new Date(`1970-01-01T${a.startTime}:00`)
    const existingEnd = new Date(`1970-01-01T${a.endTime}:00`)

    return (
      newStartDate < existingEnd &&
      newEndDate > existingStart
    )
  })
}*/

export function hasTimeConflict(newStart, newEnd, appointments, excludeId = null) {
  // Usamos una fecha base fija para comparar solo horas
  const newStartDate = new Date(`1970-01-01T${newStart}:00`);
  const newEndDate = new Date(`1970-01-01T${newEnd}:00`);

  return appointments.some(a => {
    if (excludeId && a.id === excludeId) return false;

    const existingStart = new Date(`1970-01-01T${a.startTime}:00`);
    const existingEnd = new Date(`1970-01-01T${a.endTime}:00`);

    // Lógica de solapamiento:
    // (InicioNuevo < FinExistente) Y (FinNuevo > InicioExistente)
    return newStartDate < existingEnd && newEndDate > existingStart;
  });
}