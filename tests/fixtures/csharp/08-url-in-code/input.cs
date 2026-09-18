class ApiClient
{
    const string ApiBaseUrl = "https://api.example.com/v1/users";

    List<User> FetchUsers()
    {
        return HttpGet(ApiBaseUrl);
    }
}
