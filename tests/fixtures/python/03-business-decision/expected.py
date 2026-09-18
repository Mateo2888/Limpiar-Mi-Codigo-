# Los usuarios con plan "trial" no pueden exportar reportes, por decisión de producto (ver TICKET-482).
def can_export_report(user):
    return user.plan != 'trial'
