class UserService {
    /**
     * Retorna el usuario con el id dado.
     */
    User getUser(String id) {
        return db.findById(id);
    }

    /** Guarda el timeout por defecto. */
    static int defaultTimeout = 30;
}
