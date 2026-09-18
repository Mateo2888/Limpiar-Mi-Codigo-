class OrderService
{
    int ProcessOrder(Order order)
    {
        // Procesar el pedido
        // Nota: el proveedor de pagos cobra en centavos, no en unidades monetarias completas.
        var amountInCents = (int)(order.Total * 100);

        // Validar el monto
        if (amountInCents <= 0)
        {
            throw new ArgumentException();
        }

        // Este límite viene de una restricción del banco emisor, no es arbitrario.
        if (amountInCents > 5_000_000)
        {
            throw new ArgumentException();
        }

        // Retornar el resultado
        return Charge(amountInCents);
    }
}
