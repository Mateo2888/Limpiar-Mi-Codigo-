class ApiConstants
{
    const string Path = "https://example.com/api // not a comment";
    const string Separator = "// this looks like a comment but is a string value";

    static string BuildFragment(string baseUrl, string segment)
    {
        return baseUrl + "//" + segment;
    }
}
