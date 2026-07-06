from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required

from .models import Cart, CartItem
from apps.products.models import Product
from apps.orders.models import Order, OrderItem
from apps.notifications.models import Notification


def cart_view(request):
    if request.user.is_authenticated:
        if not hasattr(request.user, 'profile') or request.user.profile.role != 'buyer':
            messages.error(request, "Only buyers can access the cart.")
            return redirect('home_view')
        buyer_profile = request.user.profile
        cart, created = Cart.objects.get_or_create(buyer=buyer_profile)
        cart_items = cart.items.select_related('product', 'product__farmer').all()
        total_price = sum(item.subtotal() for item in cart_items)
        context = {'cart_items': cart_items, 'total_price': total_price}
    else:
        session_cart = request.session.get('cart', {})
        cart_items = []
        total_price = 0
        for product_id, quantity in session_cart.items():
            try:
                product = Product.objects.select_related('farmer').get(product_id=product_id)
                subtotal = product.price_per_unit * quantity
                total_price += subtotal
                cart_items.append({
                    'product': product, 'quantity': quantity, 'subtotal': subtotal,
                    'is_session': True, 'cart_item_id': product_id
                })
            except Product.DoesNotExist:
                continue
        context = {'cart_items': cart_items, 'total_price': total_price, 'is_anonymous': True}
    return render(request, "cart/cart.html", context)


def add_to_cart_view(request, product_id):
    if request.method != "POST":
        return redirect('product_list_view')
    try:
        product = Product.objects.get(product_id=product_id)
    except Product.DoesNotExist:
        messages.error(request, "Product not found.")
        return redirect('product_list_view')
    if product.stock_quantity <= 0:
        messages.error(request, f"Sorry, {product.name} is out of stock.")
        return redirect('product_list_view')
    if request.user.is_authenticated:
        if not hasattr(request.user, 'profile') or request.user.profile.role != 'buyer':
            messages.error(request, "Please create a buyer account to add items to cart.")
            return redirect('product_list_view')
        buyer_profile = request.user.profile
        cart, _ = Cart.objects.get_or_create(buyer=buyer_profile)
        cart_item, item_created = CartItem.objects.get_or_create(cart=cart, product=product)
        if not item_created:
            if cart_item.quantity < product.stock_quantity:
                cart_item.quantity += 1
                cart_item.save()
                messages.success(request, f"Added another {product.name} to your cart.")
            else:
                messages.warning(request, f"Not enough stock to add more {product.name}.")
        else:
            messages.success(request, f"{product.name} added to your cart.")
    else:
        cart = request.session.get('cart', {})
        product_id_str = str(product_id)
        if product_id_str in cart:
            if cart[product_id_str] < product.stock_quantity:
                cart[product_id_str] += 1
                messages.success(request, f"Added another {product.name} to your cart.")
            else:
                messages.warning(request, f"Not enough stock to add more {product.name}.")
        else:
            cart[product_id_str] = 1
            messages.success(request, f"{product.name} added to your cart.")
        request.session['cart'] = cart
        request.session.modified = True
    return redirect('product_list_view')


def update_cart_view(request, item_id):
    if request.method == "POST":
        action = request.POST.get('action')
        if request.user.is_authenticated:
            if not hasattr(request.user, 'profile') or request.user.profile.role != 'buyer':
                messages.error(request, "Item not found in your cart.")
                return redirect('cart_view')
            buyer_profile = request.user.profile
            try:
                cart_item = CartItem.objects.get(cart_item_id=item_id, cart__buyer=buyer_profile)
            except CartItem.DoesNotExist:
                messages.error(request, "Item not found in your cart.")
                return redirect('cart_view')
            if action == 'increase':
                if cart_item.quantity < cart_item.product.stock_quantity:
                    cart_item.quantity += 1
                    cart_item.save()
                else:
                    messages.warning(request, f"Not enough stock to add more {cart_item.product.name}.")
            elif action == 'decrease':
                if cart_item.quantity > 1:
                    cart_item.quantity -= 1
                    cart_item.save()
                else:
                    cart_item.delete()
                    messages.success(request, f"{cart_item.product.name} removed from cart.")
            elif action == 'remove':
                cart_item.delete()
                messages.success(request, f"{cart_item.product.name} removed from cart.")
        else:
            cart = request.session.get('cart', {})
            product_id = str(item_id)
            if product_id in cart:
                try:
                    product = Product.objects.get(product_id=product_id)
                    if action == 'increase':
                        if cart[product_id] < product.stock_quantity:
                            cart[product_id] += 1
                        else:
                            messages.warning(request, f"Not enough stock to add more {product.name}.")
                    elif action == 'decrease':
                        if cart[product_id] > 1:
                            cart[product_id] -= 1
                        else:
                            del cart[product_id]
                            messages.success(request, f"{product.name} removed from cart.")
                    elif action == 'remove':
                        del cart[product_id]
                        messages.success(request, f"{product.name} removed from cart.")
                except Product.DoesNotExist:
                    if product_id in cart:
                        del cart[product_id]
            request.session['cart'] = cart
            request.session.modified = True
    return redirect('cart_view')


@login_required
def checkout_view(request):
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'buyer':
        messages.error(request, "Only buyers can proceed to checkout.")
        return redirect('home_view')
    buyer_profile = request.user.profile
    try:
        cart = Cart.objects.get(buyer=buyer_profile)
        cart_items = cart.items.select_related('product__farmer').all()
    except Cart.DoesNotExist:
        cart_items = []
    if not cart_items:
        messages.error(request, "Your cart is empty.")
        return redirect('cart_view')

    items_by_farmer = {}
    for item in cart_items:
        farmer = item.product.farmer
        if farmer not in items_by_farmer:
            items_by_farmer[farmer] = []
        items_by_farmer[farmer].append(item)

    for farmer, items in items_by_farmer.items():
        order = Order.objects.create(buyer=buyer_profile, farmer=farmer, status='PENDING')
        for item in items:
            OrderItem.objects.create(
                order=order, product=item.product,
                quantity=item.quantity, price_at_order=item.product.price_per_unit
            )
            item.product.stock_quantity -= item.quantity
            item.product.save()
        Notification.objects.create(
            recipient=farmer, order=order,
            message=f"New order #{order.order_id} from {buyer_profile.user.username}"
        )

    cart.items.all().delete()
    messages.success(request, "Checkout successful! Your orders have been placed.")
    return redirect('/buyer/dashboard/?tab=orders#orders')
