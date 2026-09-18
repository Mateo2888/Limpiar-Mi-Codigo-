class UserService {
    User getUser(String id) {
        // Verificar si el usuario existe
        User user = db.findById(id);

        // Si no existe, retornar error
        if (user == null) {
            throw new NotFoundException();
        }

        // Devolver el usuario
        return user;
    }
}
