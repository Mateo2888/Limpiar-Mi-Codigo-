// Procesar el pedido
function processOrder(order: Order) {
  // Nota: el proveedor de pagos cobra en centavos, no en unidades monetarias completas.
  const amountInCents = Math.round(order.total * 100);

  // Validar el monto
  if (amountInCents <= 0) {
    throw new Error('Invalid amount');
  }

  // Este límite viene de una restricción del banco emisor, no es arbitrario.
  if (amountInCents > 5_000_000) {
    throw new Error('Amount exceeds bank limit');
  }

  // Retornar el resultado
  return charge(amountInCents);
}
