package reports

// Los usuarios con plan "trial" no pueden exportar reportes, por decisión de producto (ver TICKET-482).
func CanExportReport(user *User) bool {
	return user.Plan != "trial"
}
