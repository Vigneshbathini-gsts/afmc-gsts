create or replace package body "XXAFMC_ORDER_PROCESS_PKG" as
Procedure Process_Order_item (p_order_number varchar2
,p_barcode varchar2
,p_qty varchar2
,x_item_id out varchar2
,x_inv_item_id out varchar2
,x_err_code out varchar2
,x_error_msg out varchar2)
is 
l_stock               NUMBER;
l_ordered_qty         NUMBER;
l_total_scanned_qty   NUMBER;
l_pegs                NUMBER;
l_total_pegs          NUMBER;
l_barcode_scanned_qty NUMBER;
l_ac_unit             VARCHAR2(10);
l_sp varchar2(1) := 'Y';
l_child_item          VARCHAR2(100);
l_parent_item         VARCHAR2(100);
l_total_qty           NUMBER;
l_cust_excp exception;
l_scan_item number;
l_scan_item_qty number;
l_ord_qty_item number;

l_food_pr_charges number;
l_pr_charges number;
l_role_id  number;
l_pft NUMBER;
l_non_pft NUMBER;
--l_pegs   NUMBER;
l_profit  NUMBER;
l_unit_price  NUMBER;
l_itemcode   number;
L_FREE_ITEM_CODE  number;
l_offer_code   number;
l_price number;
l_notification_id  number;
l_sub_Category number;
l_cal_price number;
l_req_qty number;

cursor c_ord_dt(p_order_number varchar2,p_scan_item varchar2) 
is
select * from 
(select distinct x.item_code,x.item_name,(x.pegs*x.quantity)as quantity,x.inventory_item_code,'MO' Mix
,(x.pegs*x.quantity)-(select NVL(SUM(TO_NUMBER(c003)), 0) from apex_collections 
where collection_name = 'S_COLLECTION'
and c006 = x.order_number 
and c001 = x.item_code
and c008 = x.inventory_item_code) coll_qty 
from xxafmc_custom_cocktails_mocktails_details x ,
     xxafmc_order_details xo
   where x.inventory_item_code =xo.item_id 
  -- and x.item_code = xo.item_id
   and x.order_number = p_order_number
   and x.item_code = p_scan_item
union all
   select x.item_code,x.item_name,(x.pegs*x.quantity)as quantity,x.inventory_item_code ,'MO' Mix
   ,(x.pegs*x.quantity)-(select NVL(SUM(TO_NUMBER(c003)), 0) from apex_collections 
where collection_name = 'S_COLLECTION'
and c006 = x.order_number 
and c001 = x.item_code
and c008 = x.inventory_item_code) coll_qty 
from xxafmc_custom_cocktails_mocktails_details_dummy x ,
xxafmc_order_details xo
   where x.inventory_item_code =xo.item_id 
   and x.order_number = p_order_number
   and x.item_code = p_scan_item
union all  
   select xi.item_code,xi.item_name,( decode(xo.type,'Large',2,1)* xo.QUANTITY)as quantity,to_char(xo.ITEM_ID) ,'I' Mix
   ,( decode(xo.type,'Large',2,1)* xo.QUANTITY)- (select NVL(SUM(TO_NUMBER(c003)), 0) from apex_collections 
where collection_name = 'S_COLLECTION'
and c006 = order_id 
and c001 = xi.item_code
and c008 = xi.item_code) coll_qty
   from xxafmc_order_details xo, xxafmc_inventory xi where order_id = p_order_number
   and xi.item_code = xo.ITEM_ID
   and xi.UNIT_PRICE is not null
   and xi.item_code = p_scan_item
 ) A
where 1=1
and  coll_qty>0
order by Mix;

BEGIN
l_req_qty:= p_qty;
select stock_quantity,item_code,"A/C_UNIT"
into l_stock,l_scan_item,l_ac_unit
from xxafmc_stock_out
where 1=1
and barcode = p_barcode;

if l_stock = 0 then 
		x_err_code := 0; -- more bottles scanned than ordered
		x_error_msg:= 'Scanned Barcode '||p_barcode|| ' has no stock in Bar ';
        test_log_pkg.log('Error: Scanned Barcode '||p_barcode|| ' has no stock in Bar ');
		raise l_cust_excp;
end if;	

--added
l_parent_item := NULL;
SELECT inventory_item_code
INTO l_parent_item
FROM (
    SELECT inventory_item_code
    FROM (
        SELECT inventory_item_code
        FROM xxafmc_custom_cocktails_mocktails_details
        WHERE order_number = p_order_number
        AND item_code = l_scan_item
        UNION ALL
        SELECT inventory_item_code
        FROM xxafmc_custom_cocktails_mocktails_details_dummy
        WHERE order_number = p_order_number
        AND item_code = l_scan_item
        UNION ALL
        SELECT to_char(item_id)
        FROM xxafmc_order_details
        WHERE order_id = p_order_number
        AND item_id = l_scan_item
    )
)
WHERE ROWNUM = 1;


SELECT NVL(SUM(TO_NUMBER(c003)),0)
INTO l_total_scanned_qty
FROM apex_collections
WHERE collection_name = 'S_COLLECTION'
AND c006 = p_order_number
AND c001 = l_scan_item
and c005 = p_barcode
and c008 =l_parent_item;   --parentitem need to be add c008

SELECT NVL(SUM(TO_NUMBER(c003)),0)
INTO l_scan_item_qty
FROM apex_collections
WHERE collection_name = 'S_COLLECTION'
AND c006 = p_order_number
AND c001 = l_scan_item;
--and c008 =l_parent_item;

SELECT COUNT(1)
INTO l_barcode_scanned_qty
FROM apex_collections
WHERE collection_name = 'S_COLLECTION'
AND c006 = p_order_number
AND c005 = p_barcode;
--and c008 =l_parent_item;

-- get the order_qty for an item_
select sum(quantity)  
into l_ord_qty_item
from 
(select distinct x.item_code,x.item_name,(x.pegs*x.quantity)as quantity,x.inventory_item_code,'MO' Mix
from xxafmc_custom_cocktails_mocktails_details x ,
     xxafmc_order_details xo
   where x.inventory_item_code =xo.item_id 
  and xo.order_id = x.order_number
   and x.order_number = p_order_number
   and x.item_code = l_scan_item
union all
   select x.item_code,x.item_name,(x.pegs*x.quantity)as quantity,x.inventory_item_code ,'MO' Mix
from xxafmc_custom_cocktails_mocktails_details_dummy x ,
xxafmc_order_details xo
   where x.inventory_item_code =xo.item_id 
   and xo.order_id = x.order_number
   and x.order_number = p_order_number
   and x.item_code = l_scan_item
union all  
   select xi.item_code,xi.item_name,(decode(xo.type,'Large',2,1)*xo.QUANTITY)as quantity,to_char(xo.ITEM_ID) ,'I' Mix  --decode(xo.type,'Large',2,1)*
   from xxafmc_order_details xo, xxafmc_inventory xi where order_id = p_order_number
   and xi.item_code = xo.ITEM_ID
   and xi.UNIT_PRICE is not null
   and xi.item_code = l_scan_item
   ) a;

IF l_ac_unit IN ('Nos','Can','glass') THEN

IF l_barcode_scanned_qty >=1 THEN
     x_err_code := 0; -- duplicate scan
	 x_error_msg:= 'Error: Duplicate bottle scan for ' || p_barcode;
        test_log_pkg.log('Error: Duplicate bottle scan for ' || p_barcode);
       
		raise l_cust_excp;

end if;
IF p_qty > l_stock  THEN   --added by pranaya
     x_err_code := 0; -- duplicate scan
	 x_error_msg:= 'Error: Entered quantity is more than the stock ' || p_barcode;
        test_log_pkg.log('Error: Entered quantity is more than the stock' || p_barcode);
       
		raise l_cust_excp;  

end if;            --end  
 test_log_pkg.log('l_barcode_scanned_qty --> '||l_barcode_scanned_qty);
test_log_pkg.log('l_ord_qty_item --> '||l_ord_qty_item);
test_log_pkg.log('l_scan_item_qty --> '||l_scan_item_qty);
test_log_pkg.log('p_qty --> '||p_qty);
If l_ord_qty_item < l_scan_item_qty + p_qty

then
x_err_code := 0; -- more bottles scanned than ordered
		x_error_msg:= 'Error: Scanned Qty is morethan Order quantity';
        test_log_pkg.log('Error: Scanned Qty is morethan Order quantity');
		raise l_cust_excp;
end if;

else	
test_log_pkg.log('l_ord_qty_item --> '||l_ord_qty_item);
test_log_pkg.log('l_scan_item_qty --> '||l_scan_item_qty);
test_log_pkg.log('p_qty --> '||p_qty);
IF  to_number(l_total_scanned_qty) + to_number(p_qty) > to_number(l_stock)
  then 
		x_err_code := 0; -- more bottles scanned than ordered
		x_error_msg:= 'Error: Scanned Qty is morethen stock for barcode '||p_barcode;
        test_log_pkg.log('Error: Scanned Qty is morethen stock for barcode '||p_barcode);
		raise l_cust_excp;
end if;	

If l_ord_qty_item < l_scan_item_qty + p_qty

then
x_err_code := 0; -- more bottles scanned than ordered
		x_error_msg:= 'Error: Scanned Qty is morethan Order quantity';
        test_log_pkg.log('Error: Scanned Qty is morethan Order quantity');
		raise l_cust_excp;
end if;

end if;
--- logic for Price calclulation


begin
begin
test_log_pkg.log('price-inside begin');
SELECT xu.role_id 
into l_role_id
FROM XXAFMC_USERS xu,
xxafmc_role xr,
XXAFMC_KITCHEN_NOTIFICATION xkn
WHERE 1=1
and xu.role_id = xr.role_id
and xu.user_id = xkn.USER_NAME
and xkn.ordernumber= p_order_number
and rownum =1;
end;
begin
select profit,non_member_profit
into l_pft , l_non_pft
from xxafmc_inventory 
where item_code = l_scan_item ;
EXCEPTION
WHEN NO_DATA_FOUND THEN
l_pft := 0;
l_non_pft := 0;
END;	
BEGIN
SELECT PR_charges, Food_pr_charges
INTO l_pr_charges, l_food_pr_charges  
FROM xxafmc_inventory
WHERE item_code = l_scan_item AND FLAG = 'Y';
EXCEPTION
WHEN NO_DATA_FOUND THEN
      l_pr_charges := 0;
  l_food_pr_charges := 0;
  END;	
  SELECT DECODE(pegs,NULL,1,0,1,PEGS) 
  INTO l_pegs
  FROM XXAFMC_stock_out
  WHERE item_code = l_scan_item
 and rownum=1;
 test_log_pkg.log('pegs: '|| l_pegs);
 test_log_pkg.log('item_code: '||l_scan_item);
 begin
 select item_id,PRICE
into l_free_item_code,l_price
 from XXAFMC_ORDER_DETAILS XOD
 where 1 = 1
 and order_id = p_order_number
 and xod.item_id = l_scan_item
 and XOD.BARCODE is not null
 and xod.FREE_ITEM_QUANTITY is null;
 exception
 when OTHERS then
    L_FREE_ITEM_CODE := 0;
	l_price := null;
   end;
 BEGIN
SELECT XOD.SUBCATEGORY
INTO l_sub_Category
FROM XXAFMC_ORDER_DETAILS XOD,
XXAFMC_CUSTOM_COCKTAILS_MOCKTAILS_DETAILS XCMD
where XOD.ITEM_ID = XCMD.inventory_ITEM_CODE
and XCMD.item_code = l_scan_item
AND XCMD.ORDER_NUMBER = p_order_number
AND XOD.ORDER_ID = p_order_number
and rownum  = 1;
EXCEPTION WHEN NO_DATA_FOUND THEN
begin
SELECT XOD.SUBCATEGORY
INTO l_sub_Category
FROM XXAFMC_ORDER_DETAILS XOD,
XXAFMC_CUSTOM_COCKTAILS_MOCKTAILS_DETAILS_DUMMY XCMD
where XOD.ITEM_ID = XCMD.inventory_ITEM_CODE
and XCMD.ITEM_CODE = l_scan_item
AND XCMD.ORDER_NUMBER = p_order_number
AND XOD.ORDER_ID = p_order_number
and rownum  = 1;
EXCEPTION WHEN NO_DATA_FOUND THEN
SELECT XOD.SUBCATEGORY
INTO l_sub_Category
FROM XXAFMC_ORDER_DETAILS XOD
where XOD.ITEM_ID = l_scan_item
AND XOD.ORDER_ID = p_order_number
and rownum  = 1;
end;
end;
test_log_pkg.log('itemcode: '||l_scan_item);
if  l_scan_item= L_FREE_ITEM_CODE  and l_price = 0 then 
l_cal_price :=0;
begin 
update XXAFMC_ORDER_DETAILS
set FREE_ITEM_QUANTITY = 1
where 1 = 1
and order_id = p_order_number
and item_id = l_scan_item
and BARCODE is not null;
end ; 
else	
if l_sub_Category in (14,15) then 	
SELECT xso.unit_price 
into l_unit_price
FROM xxafmc_stock_out xso
WHERE xso.item_code =l_scan_item
AND xso.stock_quantity > 0
and xso.barcode= p_barcode;
else
SELECT xso.unit_price 
into l_unit_price
FROM xxafmc_stock_out xso
WHERE xso.item_code =l_scan_item
AND xso.stock_quantity > 0
and xso.barcode= p_barcode
and exists (select 1
from XXAFMC_ORDER_DETAILS XOD
where 1 = 1
and xod.item_id = xso.item_code 
and order_id = p_order_number
and XOD.BARCODE is null
and xod.price is null);
end if;
if l_role_id = 20 then
test_log_pkg.log('roleid: '||l_role_id);
test_log_pkg.log('food pr charges: '||l_food_pr_charges);
test_log_pkg.log('pegs: '||l_pegs);
test_log_pkg.log('unit_price: '||l_unit_price);
l_profit := ((l_unit_price / l_pegs) + ((l_unit_price / l_pegs) * l_pft / 100)+nvl(l_food_pr_charges,0));
l_cal_price:= (TO_CHAR(l_profit, 'FM99999999990.00'));--+nvl(l_food_pr_charges,0)
test_log_pkg.log('profit: '||l_profit);
test_log_pkg.log('price: '||l_cal_price);
ELSE
l_profit := ((l_unit_price / l_pegs) + ((l_unit_price / l_pegs) * l_non_pft / 100)+nvl(l_pr_charges,0));
l_cal_price:= (TO_CHAR(l_profit, 'FM99999999990.00')); --+nvl(l_pr_charges,0)
end if;
end if;
EXCEPTION WHEN OTHERS THEN 
NULL;
test_log_pkg.log('process end');
end;


----- Insert logic to the collection for scan itemcode

for i in c_ord_dt(p_order_number,l_scan_item  )
LOOP
	
If l_req_qty > 0  
then
if  i.coll_qty >= l_req_qty
then 
 apex_collection.add_member(
    
            p_collection_name => 'S_COLLECTION',
            p_c001 => i.item_code,
            p_c002 => i.item_name,
            p_c003 => l_req_qty,
            p_d001 => sysdate,
            p_c004 => l_cal_price,
            p_c005 => p_barcode,
            p_c006 => p_order_number,
            p_c007 => null,
            p_c008 => i.inventory_item_code
			);
	l_req_qty:= 0;
else
apex_collection.add_member(
    
            p_collection_name => 'S_COLLECTION',
            p_c001 => i.item_code,
            p_c002 => i.item_name,
            p_c003 => i.coll_qty,
            p_d001 => sysdate,
            p_c004 => l_cal_price,
            p_c005 => p_barcode,
            p_c006 => p_order_number,
            p_c007 => null,
            p_c008 => i.inventory_item_code
			);
		l_req_qty:=l_req_qty- i.coll_qty;	
end if;	
		
end if;

END LOOP;

exception when l_cust_excp
  then
  null;
  when others
  then 
  null;
end;

end "XXAFMC_ORDER_PROCESS_PKG";
/