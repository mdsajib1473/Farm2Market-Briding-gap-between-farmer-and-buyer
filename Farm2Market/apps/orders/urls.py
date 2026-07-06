from django.urls import path
from . import views


urlpatterns = [
    path('buyer/dashboard/',                        views.buyer_dashboard_view,      name='buyer_dashboard_view'),
    path('order/action/buyer/<int:order_id>/',      views.buyer_order_action_view,   name='buyer_order_action_view'),
    path('order/action/farmer/<int:order_id>/',     views.farmer_order_action_view,  name='farmer_order_action_view'),
]
