def process_order(order):
    # Nota: el proveedor de pagos cobra en centavos, no en unidades monetarias completas.
    amount_in_cents = round(order.total * 100)

    if amount_in_cents <= 0:
        raise ValueError('Invalid amount')

    # Este límite viene de una restricción del banco emisor, no es arbitrario.
    if amount_in_cents > 5_000_000:
        raise ValueError('Amount exceeds bank limit')

    return charge(amount_in_cents)
