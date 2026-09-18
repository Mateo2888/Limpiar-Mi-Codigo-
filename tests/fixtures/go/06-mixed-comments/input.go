package orders

func ProcessOrder(order *Order) (int, error) {
	// Procesar el pedido
	// Nota: el proveedor de pagos cobra en centavos, no en unidades monetarias completas.
	amountInCents := int(order.Total * 100)

	// Validar el monto
	if amountInCents <= 0 {
		return 0, ErrInvalidAmount
	}

	// Este límite viene de una restricción del banco emisor, no es arbitrario.
	if amountInCents > 5_000_000 {
		return 0, ErrAmountExceedsLimit
	}

	// Retornar el resultado
	return Charge(amountInCents)
}
