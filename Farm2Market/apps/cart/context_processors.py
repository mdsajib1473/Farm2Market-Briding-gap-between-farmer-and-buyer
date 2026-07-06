from .models import CartItem


def cart_count(request):
    """
    Injects `cart_count` (total number of distinct items in the buyer's cart)
    into every template context. Supports both authenticated and session-based carts.
    """
    if request.user.is_authenticated:
        count = CartItem.objects.filter(cart__buyer__user=request.user).count()
        return {'cart_count': count}

    # Session-based cart count
    session_cart = request.session.get('cart', {})
    return {'cart_count': len(session_cart)}
