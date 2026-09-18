package api

const APIBaseURL = "https://api.example.com/v1/users"

func FetchUsers() ([]User, error) {
	return httpGet(APIBaseURL)
}
