class ApiConstants {
    static final String PATH = "https://example.com/api // not a comment";
    static final String SEPARATOR = "// this looks like a comment but is a string value";

    static String buildFragment(String base, String segment) {
        return base + "//" + segment;
    }
}
