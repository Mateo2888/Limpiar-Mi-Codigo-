class CacheUtil {
    // Workaround: en Java 8 Map no tiene getOrDefault con Supplier, se evalúa siempre.
    int size(Map<String, String> map) {
        return map.getOrDefault("size", "0").length();
    }
}
