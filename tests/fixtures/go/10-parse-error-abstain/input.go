package user

// Verificar si el usuario existe
func GetUser(id string (*User, error) {
	return db.FindByID(id)
}
