from django.shortcuts import render, redirect
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q

from .models import Profile
from apps.products.models import Product
from apps.cart.models import Cart, CartItem


# ---------------------------------------------------------------------------
# REGISTER VIEW
# ---------------------------------------------------------------------------
def register_view(request):
    if request.method == "POST":
        username = request.POST.get("username")
        email = request.POST.get("email")
        password = request.POST.get("password")
        confirm_password = request.POST.get("confirm_password")
        role = request.POST.get("role")

        if not password or password != confirm_password:
            messages.error(request, "Passwords are required and must match.")
            return redirect("register_view")

        if User.objects.filter(username=username).exists():
            messages.error(request, "Username already exists.")
            return redirect("register_view")

        if User.objects.filter(email=email).exists():
            messages.error(request, "Email already registered.")
            return redirect("register_view")

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        if role == "farmer":
            farm_name = request.POST.get("farm_name")
            farm_location = request.POST.get("farm_location")
            bio = request.POST.get("bio")

            if not farm_name or not farm_location:
                messages.error(request, "Farm name and location are required.")
                user.delete()
                return redirect("register_view")

            Profile.objects.create(
                user=user,
                role=role,
                farm_name=farm_name,
                farm_location=farm_location,
                bio=bio
            )

        elif role == "buyer":
            delivery_address = request.POST.get("delivery_address")

            if not delivery_address:
                messages.error(request, "Delivery address is required.")
                user.delete()
                return redirect("register_view")

            Profile.objects.create(
                user=user,
                role=role,
                delivery_address=delivery_address
            )
        else:
            user.delete()
            messages.error(request, "Invalid role selected.")
            return redirect("register_view")

        messages.success(request, "Registration successful! You can now log in.")
        return redirect("login_view")

    return render(request, "accounts/register.html")


# ---------------------------------------------------------------------------
# LOGIN VIEW
# ---------------------------------------------------------------------------
def login_view(request):
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)

            # Merge session cart into database cart on login
            session_cart = request.session.get('cart', {})
            if session_cart and hasattr(user, 'profile') and user.profile.role == 'buyer':
                buyer_profile = user.profile
                cart, created = Cart.objects.get_or_create(buyer=buyer_profile)

                for product_id, quantity in session_cart.items():
                    try:
                        product = Product.objects.get(product_id=product_id)
                        cart_item, item_created = CartItem.objects.get_or_create(
                            cart=cart, product=product
                        )
                        if not item_created:
                            cart_item.quantity = min(
                                cart_item.quantity + quantity, product.stock_quantity
                            )
                        else:
                            cart_item.quantity = min(quantity, product.stock_quantity)
                        cart_item.save()
                    except Product.DoesNotExist:
                        continue

                del request.session['cart']

            if hasattr(user, 'profile') and user.profile.role == 'farmer':
                return redirect("farmer_dashboard_view")
            else:
                return redirect("home_view")
        else:
            messages.error(request, "Invalid username or password.")
            return redirect("login_view")

    return render(request, "accounts/login.html")


# ---------------------------------------------------------------------------
# LOGOUT VIEW
# ---------------------------------------------------------------------------
@login_required
def logout_view(request):
    logout(request)
    messages.success(request, "Logged out successfully.")
    return redirect("home_view")


# ---------------------------------------------------------------------------
# PROFILE VIEW (farmer & buyer)
# ---------------------------------------------------------------------------
@login_required
def profile_view(request):
    user = request.user

    if request.method == "POST":
        action = request.POST.get("action")
        if action == "update_profile":
            user.first_name = request.POST.get("first_name", user.first_name)
            user.last_name = request.POST.get("last_name", user.last_name)
            user.email = request.POST.get("email", user.email)
            user.save()

            if hasattr(user, 'profile'):
                profile = user.profile
                if profile.role == 'farmer':
                    profile.farm_name = request.POST.get("farm_name", profile.farm_name)
                    profile.farm_location = request.POST.get(
                        "farm_location", profile.farm_location
                    )
                    profile.bio = request.POST.get("bio", profile.bio)
                elif profile.role == 'buyer':
                    profile.delivery_address = request.POST.get(
                        "delivery_address", profile.delivery_address
                    )
                profile.save()
            messages.success(request, "Profile updated successfully.")
            return redirect('profile_view')

    # Compute initials
    full_name = user.get_full_name()
    if full_name.strip():
        parts = full_name.split()
        initials = (parts[0][0] + parts[-1][0]).upper() if len(parts) > 1 else parts[0][:2].upper()
    else:
        initials = user.username[:2].upper()

    is_farmer = hasattr(user, 'profile') and user.profile.role == 'farmer'
    farmer_profile = None
    total_products = in_stock_products = out_of_stock_products = 0

    if is_farmer:
        farmer_profile = user.profile
        products_qs = Product.objects.filter(farmer=farmer_profile)
        stats = products_qs.aggregate(
            total=Count('product_id'),
            in_stock=Count('product_id', filter=Q(stock_quantity__gt=0)),
            out_stock=Count('product_id', filter=Q(stock_quantity=0))
        )
        total_products = stats['total'] or 0
        in_stock_products = stats['in_stock'] or 0
        out_of_stock_products = stats['out_stock'] or 0

    active_tab = request.GET.get('tab', 'profile')
    valid_tabs = ['profile', 'farm'] if is_farmer else ['profile']
    if active_tab not in valid_tabs:
        active_tab = 'profile'

    context = {
        'initials': initials,
        'is_farmer': is_farmer,
        'farmer_profile': farmer_profile,
        'total_products': total_products,
        'in_stock_products': in_stock_products,
        'out_of_stock_products': out_of_stock_products,
        'active_tab': active_tab,
    }

    template_name = "accounts/farmer_profile.html" if is_farmer else "accounts/buyer_profile.html"
    return render(request, template_name, context)
