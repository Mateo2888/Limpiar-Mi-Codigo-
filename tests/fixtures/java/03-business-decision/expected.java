class ReportService {
    // Los usuarios con plan "trial" no pueden exportar reportes, por decisión de producto (ver TICKET-482).
    boolean canExportReport(User user) {
        return !"trial".equals(user.getPlan());
    }
}
