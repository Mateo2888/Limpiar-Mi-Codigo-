class ReportService
{
    // Los usuarios con plan "trial" no pueden exportar reportes, por decisión de producto (ver TICKET-482).
    bool CanExportReport(User user)
    {
        return user.Plan != "trial";
    }
}
