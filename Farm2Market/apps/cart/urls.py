from django.urls import path
from . import views


urlpatterns = [
    path('cart/',                          views.cart_view,         name='cart_view'),
    path('cart/add/<int:product_id>/',     views.add_to_cart_view,  name='add_to_cart_view'),
    path('cart/update/<int:item_id>/',     views.update_cart_view,  name='update_cart_view'),
    path('checkout/',                      views.checkout_view,     name='checkout_view'),
]
