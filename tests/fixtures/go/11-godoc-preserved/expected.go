package user

// GetUser retorna el usuario con el id dado.
func GetUser(id string) (*User, error) {
	return db.FindByID(id)
}

// DefaultTimeout guarda el timeout por defecto.
var DefaultTimeout = 30

// Cache guarda usuarios recientemente consultados.
type Cache struct {
	entries map[string]*User
}
