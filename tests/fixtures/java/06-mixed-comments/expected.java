class OrderService {
    /**
     * Procesa el pedido y cobra el monto correspondiente.
     */
    int processOrder(Order order) {
        // Nota: el proveedor de pagos cobra en centavos, no en unidades monetarias completas.
        int amountInCents = (int) (order.getTotal() * 100);

        if (amountInCents <= 0) {
            throw new IllegalArgumentException();
        }

        // Este límite viene de una restricción del banco emisor, no es arbitrario.
        if (amountInCents > 5_000_000) {
            throw new IllegalArgumentException();
        }

        return charge(amountInCents);
    }
}
