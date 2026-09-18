// Los usuarios con plan "trial" no pueden exportar reportes, por decisión de producto (ver TICKET-482).
function canExportReport(user: User): boolean {
  return user.plan !== 'trial';
}
