from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q

from .models import Order, OrderItem, Logistic
from apps.notifications.models import Notification


@login_required
def buyer_dashboard_view(request):
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'buyer':
        messages.error(request, "Only buyers can access the dashboard.")
        return redirect('home_view')

    buyer_profile = request.user.profile
    buyer_orders = Order.objects.filter(
        buyer=buyer_profile
    ).prefetch_related('items__product', 'farmer').order_by('-created_at')

    stats = buyer_orders.aggregate(
        total_orders=Count('order_id'),
        completed=Count('order_id', filter=Q(status='COMPLETED'))
    )
    total_orders = stats['total_orders'] or 0
    completed_orders = stats['completed'] or 0

    total_spent = 0
    for order in buyer_orders.filter(status='COMPLETED'):
        for item in order.items.all():
            total_spent += item.subtotal()

    active_tab = request.GET.get('tab', 'overview')
    valid_tabs = ['overview', 'orders']
    if active_tab not in valid_tabs:
        active_tab = 'overview'

    context = {
        'buyer_orders': buyer_orders,
        'total_orders': total_orders,
        'completed_orders': completed_orders,
        'total_spent': total_spent,
        'active_tab': active_tab,
    }
    return render(request, "orders/buyer_dashboard.html", context)


@login_required
def buyer_order_action_view(request, order_id):
    if request.method != "POST" or not hasattr(request.user, 'profile') \
            or request.user.profile.role != 'buyer':
        return redirect('home_view')

    buyer_profile = request.user.profile
    try:
        order = Order.objects.get(order_id=order_id, buyer=buyer_profile)
    except Order.DoesNotExist:
        messages.error(request, "Order not found.")
        return redirect('/buyer/dashboard/?tab=orders')

    action = request.POST.get('action')
    if action == 'cancel' and order.status == 'PENDING':
        order.status = 'CANCELLED'
        order.save()
        for item in order.items.all():
            item.product.stock_quantity += item.quantity
            item.product.save()
        Notification.objects.create(
            recipient=order.farmer, order=order,
            message=f"{buyer_profile.user.username} cancelled their order #{order.order_id}."
        )
        messages.success(request, f"Order #{order.order_id} cancelled successfully.")
        return redirect('/buyer/dashboard/?tab=orders#orders')
    elif action == 'confirm_receipt' and order.status == 'DELIVERED':
        order.status = 'COMPLETED'
        order.save()
        Notification.objects.create(
            recipient=order.farmer, order=order,
            message=f"Order #{order.order_id} has been marked as received. \u2705"
        )
        messages.success(request, f"Order #{order.order_id} marked as completed.")
        return redirect('/buyer/dashboard/?tab=orders#orders')

    return redirect('/buyer/dashboard/?tab=orders#orders')


@login_required
def farmer_order_action_view(request, order_id):
    if request.method != "POST" or not hasattr(request.user, 'profile') \
            or request.user.profile.role != 'farmer':
        return redirect('home_view')

    farmer_profile = request.user.profile
    try:
        order = Order.objects.get(order_id=order_id, farmer=farmer_profile)
    except Order.DoesNotExist:
        messages.error(request, "Order not found.")
        return redirect('farmer_dashboard_view')

    action = request.POST.get('action')
    if action == 'confirm' and order.status == 'PENDING':
        order.status = 'CONFIRMED'
        order.save()
        Notification.objects.create(
            recipient=order.buyer, order=order,
            message=f"Your order #{order.order_id} has been confirmed by {farmer_profile.farm_name}!"
        )
        messages.success(request, f"Order #{order.order_id} confirmed.")

    elif action == 'reject' and order.status == 'PENDING':
        order.status = 'REJECTED'
        order.save()
        for item in order.items.all():
            item.product.stock_quantity += item.quantity
            item.product.save()
        Notification.objects.create(
            recipient=order.buyer, order=order,
            message=f"Unfortunately, {farmer_profile.farm_name} could not fulfill your order #{order.order_id}."
        )
        messages.success(request, f"Order #{order.order_id} rejected.")

    elif action == 'assign_logistic' and order.status == 'CONFIRMED':
        logistic_id = request.POST.get('logistic_id')
        if logistic_id:
            try:
                logistic = Logistic.objects.get(id=logistic_id)
                order.logistic = logistic
                order.status = 'ASSIGNED'
                order.save()
                Notification.objects.create(
                    recipient=order.buyer, order=order,
                    message=f"Logistic service ({logistic.name}) has been assigned to your order #{order.order_id}."
                )
                messages.success(request, f"Logistic {logistic.name} assigned to order #{order.order_id}.")
            except Logistic.DoesNotExist:
                messages.error(request, "Logistic not found.")

    elif action == 'mark_dispatched' and order.status == 'ASSIGNED':
        order.status = 'OUT_FOR_DELIVERY'
        order.save()
        Notification.objects.create(
            recipient=order.buyer, order=order,
            message=f"Your order #{order.order_id} is on the way! \U0001f69a"
        )
        messages.success(request, f"Order #{order.order_id} marked as Out for Delivery.")

    elif action == 'mark_delivered' and order.status == 'OUT_FOR_DELIVERY':
        order.status = 'DELIVERED'
        order.save()
        Notification.objects.create(
            recipient=order.buyer, order=order,
            message=f"Your order #{order.order_id} has been delivered. Please confirm receipt."
        )
        messages.success(request, f"Order #{order.order_id} marked as Delivered.")

    return redirect('/farmer/dashboard/?tab=orders')
