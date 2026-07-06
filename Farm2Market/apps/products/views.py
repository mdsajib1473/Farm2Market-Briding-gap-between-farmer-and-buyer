from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q

from .models import Product, Category
from apps.orders.models import Order, Logistic


# ---------------------------------------------------------------------------
# HOME VIEW
# ---------------------------------------------------------------------------
def home_view(request):
    categories = Category.objects.all()
    context = {'categories': categories}
    return render(request, "products/home.html", context)


# ---------------------------------------------------------------------------
# PRODUCT LIST VIEW
# ---------------------------------------------------------------------------
def product_list_view(request):
    products = Product.objects.select_related('farmer', 'category').all().order_by('-created_at')
    categories = Category.objects.all()
    selected_category = None

    search_query = request.GET.get('search')
    if search_query:
        words = search_query.split()
        if words:
            query = Q()
            for word in words:
                query |= Q(name__icontains=word)
            products = products.filter(query)

    category_id = request.GET.get('category')
    if category_id:
        try:
            selected_category = Category.objects.get(category_id=category_id)
            products = products.filter(category=selected_category)
        except Category.DoesNotExist:
            pass

    context = {
        'products': products.distinct(),
        'categories': categories,
        'selected_category': selected_category,
        'search_query': search_query
    }
    return render(request, "products/products.html", context)


# ---------------------------------------------------------------------------
# EDIT PRODUCT VIEW
# ---------------------------------------------------------------------------
@login_required
def edit_product_view(request, product_id):
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'farmer':
        messages.error(request, "You must be a farmer to edit products.")
        return redirect('home_view')
    farmer_profile = request.user.profile

    try:
        product = Product.objects.get(product_id=product_id, farmer=farmer_profile)
    except Product.DoesNotExist:
        messages.error(request, "Product not found or you don't have permission to edit it.")
        return redirect('farmer_dashboard_view')

    if request.method == "POST":
        product.name = request.POST.get("name")

        category_id = request.POST.get("category")
        if category_id:
            try:
                product.category = Category.objects.get(category_id=category_id)
            except Category.DoesNotExist:
                pass

        product.price_per_unit = request.POST.get("price_per_unit")
        product.stock_quantity = request.POST.get("stock_quantity")
        product.unit = request.POST.get("unit")
        product.description = request.POST.get("description")

        if "image" in request.FILES:
            product.image = request.FILES.get("image")

        product.save()
        messages.success(request, "Product updated successfully!")
        return redirect('farmer_dashboard_view')

    categories = Category.objects.all()
    context = {
        'product': product,
        'categories': categories
    }
    return render(request, "products/edit_product.html", context)


# ---------------------------------------------------------------------------
# FARMER DASHBOARD VIEW
# ---------------------------------------------------------------------------
@login_required
def farmer_dashboard_view(request):
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'farmer':
        messages.error(request, "You must be a farmer to view this page.")
        return redirect('home_view')
    farmer_profile = request.user.profile

    if request.method == "POST":
        action = request.POST.get("action")
        if action == "add_product":
            category_id = request.POST.get("category")
            name = request.POST.get("name")
            description = request.POST.get("description")
            price_per_unit = request.POST.get("price_per_unit")
            stock_quantity = request.POST.get("stock_quantity")
            unit = request.POST.get("unit")
            image = request.FILES.get("image")

            try:
                category = Category.objects.get(category_id=category_id)
                Product.objects.create(
                    farmer=farmer_profile,
                    category=category,
                    name=name,
                    description=description,
                    price_per_unit=price_per_unit,
                    stock_quantity=stock_quantity,
                    unit=unit,
                    image=image
                )
                messages.success(request, "Product added successfully!")
            except Exception as e:
                messages.error(request, f"Error adding product: {str(e)}")

            return redirect('farmer_dashboard_view')

    products = Product.objects.select_related('category').filter(
        farmer=farmer_profile
    ).order_by('-created_at')
    categories = Category.objects.all()

    stats = products.aggregate(
        in_stock=Count('product_id', filter=Q(stock_quantity__gt=0)),
        out_stock=Count('product_id', filter=Q(stock_quantity=0))
    )
    in_stock_count = stats['in_stock'] or 0
    out_of_stock_count = stats['out_stock'] or 0

    orders = Order.objects.filter(
        farmer=farmer_profile
    ).prefetch_related('items__product', 'logistic', 'buyer__user').order_by('-created_at')
    logistics = Logistic.objects.all()

    active_tab = request.GET.get('tab', 'dashboard')
    valid_tabs = ['dashboard', 'orders']
    if active_tab not in valid_tabs:
        active_tab = 'dashboard'

    context = {
        'products': products,
        'categories': categories,
        'in_stock_count': in_stock_count,
        'out_of_stock_count': out_of_stock_count,
        'orders': orders,
        'logistics': logistics,
        'active_tab': active_tab,
    }
    return render(request, "products/farmer_dashboard.html", context)
