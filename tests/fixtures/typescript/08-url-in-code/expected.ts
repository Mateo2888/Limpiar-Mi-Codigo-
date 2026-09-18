const API_BASE_URL = 'https://api.example.com/v1/users';

async function fetchUsers() {
  const response = await fetch(API_BASE_URL);
  return response.json();
}
