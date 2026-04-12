export function calculateTotalDuration(servicesRequested, servicesCatalog) {
  let totalMinutes = 0;

  for (const item of servicesRequested) {
    const service = servicesCatalog.find(s => s.id === item.serviceId);

    if (!service) {
      throw new Error(`Servicio con id ${item.serviceId} no existe`);
    }

    // DECLARACIÓN CORRECTA DE LAS VARIABLES
    const base = service.baseDuration || 0; // Verifica que el nombre en db.json sea baseDuration
    const extra = (service.extraDurationPerUnit || 0) * (item.quantity || 0);

    // AQUÍ ES DONDE DABA EL ERROR SI 'base' NO ESTABA ARRIBA
    totalMinutes += base + extra;
  }

  return totalMinutes;
}
