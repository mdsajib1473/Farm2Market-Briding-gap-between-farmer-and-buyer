from django.urls import path
from . import views


urlpatterns = [
    path('',                                  views.home_view,            name='home_view'),
    path('products/',                         views.product_list_view,    name='product_list_view'),
    path('farmer/dashboard/',                 views.farmer_dashboard_view, name='farmer_dashboard_view'),
    path('farmer/product/edit/<int:product_id>/', views.edit_product_view, name='edit_product_view'),
]
