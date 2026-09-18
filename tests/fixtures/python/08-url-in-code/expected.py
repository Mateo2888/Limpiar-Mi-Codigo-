API_BASE_URL = 'https://api.example.com/v1/users'


def fetch_users():
    return requests.get(API_BASE_URL).json()
