# Verificar si el usuario existe
def get_user(user_id
    return db.users.find_by_id(user_id)
