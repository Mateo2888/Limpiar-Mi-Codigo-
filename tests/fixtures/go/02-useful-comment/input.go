package billing

// El proveedor devuelve fechas en UTC aunque la configuración regional sea local.
var date = normalizeDate(value)
