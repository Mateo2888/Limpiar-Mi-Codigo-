class UserService
{
    /// <summary>Retorna el usuario con el id dado.</summary>
    User GetUser(string id)
    {
        return db.FindById(id);
    }

    /// <summary>Guarda el timeout por defecto.</summary>
    static int DefaultTimeout = 30;
}
