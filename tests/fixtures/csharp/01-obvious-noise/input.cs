class UserService
{
    User GetUser(string id)
    {
        // Verificar si el usuario existe
        var user = db.FindById(id);

        // Si no existe, retornar error
        if (user == null)
        {
            throw new NotFoundException();
        }

        // Devolver el usuario
        return user;
    }
}
