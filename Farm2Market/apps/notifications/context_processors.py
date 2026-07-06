from apps.orders.models import Order


def user_notifications(request):
    """
    Injects notification flags for farmers and buyers into every template context.
    """
    has_new_order = False
    has_delivered_order = False
    if request.user.is_authenticated:
        try:
            if hasattr(request.user, 'profile'):
                if request.user.profile.role == 'farmer':
                    has_new_order = Order.objects.filter(
                        farmer=request.user.profile, status='PENDING'
                    ).exists()
                elif request.user.profile.role == 'buyer':
                    has_delivered_order = Order.objects.filter(
                        buyer=request.user.profile, status='DELIVERED'
                    ).exists()
        except Exception:
            pass
    return {'has_new_order': has_new_order, 'has_delivered_order': has_delivered_order}
