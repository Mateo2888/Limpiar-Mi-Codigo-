package user

func GetUser(id string) (*User, error) {
	// Verificar si el usuario existe
	user, err := db.FindByID(id)
	if err != nil {
		return nil, err
	}

	// Si no existe, retornar error
	if user == nil {
		return nil, ErrNotFound
	}

	// Devolver el usuario
	return user, nil
}
