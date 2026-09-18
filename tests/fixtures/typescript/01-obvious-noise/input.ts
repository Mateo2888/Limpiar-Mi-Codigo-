async function getUser(id: string) {
  // Verificar si el usuario existe
  const user = await db.users.findById(id);

  // Si no existe, retornar error
  if (!user) {
    return null;
  }

  // Devolver el usuario
  return user;
}
