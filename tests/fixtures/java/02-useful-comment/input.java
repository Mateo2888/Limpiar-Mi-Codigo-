class BillingUtil {
    // El proveedor devuelve fechas en UTC aunque la configuración regional sea local.
    static Date date = normalizeDate(value);
}
