class ApiClient {
    static final String API_BASE_URL = "https://api.example.com/v1/users";

    List<User> fetchUsers() {
        return httpGet(API_BASE_URL);
    }
}
