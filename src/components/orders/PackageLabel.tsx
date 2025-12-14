import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Order } from '@/types/auth';

interface PackageLabelProps {
  order: Order;
  onReady?: () => void;
}

export function PackageLabel({ order, onReady }: PackageLabelProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && order.tracking_id) {
      JsBarcode(barcodeRef.current, order.tracking_id, {
        format: 'CODE128',
        width: 2,
        height: 40,
        displayValue: false,
        margin: 0,
        background: '#ffffff',
      });
      onReady?.();
    }
  }, [order.tracking_id, onReady]);

  const formatDate = (date: string | null) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Toronto'
    });
  };

  const formatAddress = () => {
    const lines = [];
    if (order.address_1) lines.push(order.address_1);
    if (order.address_2) lines.push(order.address_2);
    if (order.city) lines.push(order.city);
    const provinceLine = [order.province, order.postal].filter(Boolean).join(' ');
    if (provinceLine) lines.push(provinceLine);
    if (order.country) lines.push(order.country);
    return lines;
  };

  return (
    <div 
      id="package-label" 
      className="bg-white text-black"
      style={{ 
        width: '4in', 
        height: '6in', 
        fontFamily: 'Arial, sans-serif',
        padding: '0',
        boxSizing: 'border-box',
        border: '2px solid #000'
      }}
    >
      {/* Row 1: Header + Package Icon */}
      <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
        {/* PharmaNet Header */}
        <div style={{ 
          flex: '2',
          backgroundColor: '#9CA3AF',
          padding: '16px 20px',
          borderRight: '2px solid #000'
        }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 'bold',
            color: '#000',
            margin: 0,
            fontFamily: 'Georgia, serif',
            letterSpacing: '-0.5px'
          }}>
            PharmaNet
          </h1>
          <p style={{ 
            fontSize: '14px',
            color: '#4B5563',
            margin: '2px 0 0 0'
          }}>
            Delivery Services
          </p>
        </div>

        {/* Package Icon */}
        <div style={{ 
          flex: '1',
          backgroundColor: '#9CA3AF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px'
        }}>
          <div style={{
            width: '70px',
            height: '70px',
            backgroundColor: '#FBBF24',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Package Box SVG */}
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.5">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              <path d="m3.3 7 8.7 5 8.7-5"/>
              <path d="M12 22V12"/>
            </svg>
            {/* Checkmark */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" style={{ position: 'absolute', marginLeft: '35px', marginTop: '35px' }}>
              <circle cx="12" cy="12" r="10" fill="#fff"/>
              <path d="m9 12 2 2 4-4" stroke="#000"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Row 2: Barcode + Labels */}
      <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
        {/* Barcode */}
        <div style={{ 
          flex: '1',
          backgroundColor: '#fff',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRight: '2px solid #000'
        }}>
          <svg ref={barcodeRef} style={{ maxWidth: '100%' }}></svg>
        </div>
        
        {/* FRAGILE + Medical Supplies Labels */}
        <div style={{ 
          flex: '1',
          backgroundColor: '#9CA3AF',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          {/* FRAGILE Label */}
          <div style={{
            backgroundColor: '#DC2626',
            color: '#fff',
            padding: '6px 10px',
            fontSize: '10px',
            fontWeight: 'bold',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: '1.2'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px' }}>!</span>
              <span>FRAGILE</span>
            </div>
            <span style={{ fontSize: '7px', fontWeight: 'normal' }}>HANDLE WITH CARE</span>
          </div>
          
          {/* Medical Supplies Label */}
          <div style={{
            backgroundColor: '#DC2626',
            color: '#fff',
            padding: '6px 10px',
            fontSize: '10px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ fontSize: '12px' }}>✚</span>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
              <span>Medical</span>
              <span>Supplies</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Client Info + Delivery Address + Pharmacy Info */}
      <div style={{ display: 'flex', borderBottom: '2px solid #000', minHeight: '150px' }}>
        {/* Client Information */}
        <div style={{ 
          flex: '1',
          backgroundColor: '#fff',
          padding: '12px',
          borderRight: '2px solid #000'
        }}>
          <h3 style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            fontStyle: 'italic',
            margin: '0 0 12px 0'
          }}>
            Client Information
          </h3>
          <p style={{ fontSize: '13px', fontWeight: '500', margin: '4px 0' }}>
            {order.name || 'Client Name'}
          </p>
          {order.phone_number && (
            <p style={{ fontSize: '11px', color: '#666', margin: '2px 0' }}>
              {order.phone_number}
            </p>
          )}
        </div>

        {/* Delivery Address */}
        <div style={{ 
          flex: '1',
          backgroundColor: '#fff',
          padding: '12px',
          borderRight: '2px solid #000'
        }}>
          <h3 style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            fontStyle: 'italic',
            margin: '0 0 12px 0'
          }}>
            Delivery Address
          </h3>
          {formatAddress().map((line, index) => (
            <p key={index} style={{ fontSize: '11px', margin: '3px 0' }}>
              {line}
            </p>
          ))}
        </div>

        {/* Pharmacy Info */}
        <div style={{ 
          flex: '1',
          backgroundColor: '#fff',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Icons */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            {/* Recycle Icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.5">
              <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/>
              <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/>
              <path d="m14 16-3 3 3 3"/>
              <path d="M8.293 13.596 7.196 9.5 3.1 10.598"/>
              <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/>
              <path d="m13.378 9.633 4.096 1.098 1.097-4.096"/>
            </svg>
            {/* Hand Helping Icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.5">
              <path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/>
              <path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/>
              <path d="m2 15 6 6"/>
              <path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z"/>
            </svg>
          </div>
          
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Pharmacy:</p>
            <p style={{ fontSize: '10px', margin: '2px 0' }}>
              {order.pharmacy_name || 'Toronto Safe Clinics & Pharmacies'}
            </p>
            <p style={{ fontSize: '10px', margin: '2px 0' }}>
              PharmadocsPlus | Etobicoke
            </p>
          </div>
          
          <div style={{ 
            borderTop: '1px solid #000', 
            paddingTop: '8px',
            marginTop: 'auto'
          }}>
            <p style={{ fontSize: '11px', fontWeight: 'bold', margin: 0 }}>Shipping ID:</p>
            <p style={{ fontSize: '12px', fontFamily: 'monospace', margin: '2px 0 0 0' }}>
              {order.shipment_id || 'Not assigned'}
            </p>
          </div>
        </div>
      </div>

      {/* Row 4: Tracking # + Shipping Date */}
      <div style={{ display: 'flex' }}>
        {/* Tracking # */}
        <div style={{ 
          flex: '1',
          backgroundColor: '#fff',
          padding: '12px',
          borderRight: '2px solid #000'
        }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0 }}>
            Tracking #:
          </p>
          <p style={{ fontSize: '13px', fontFamily: 'monospace', margin: '4px 0 0 0' }}>
            {order.tracking_id || 'Not assigned'}
          </p>
        </div>

        {/* Shipping Date */}
        <div style={{ 
          flex: '1',
          backgroundColor: '#fff',
          padding: '12px'
        }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0 }}>
            Shipping Date:
          </p>
          <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>
            {formatDate(order.ship_date)}
          </p>
        </div>
      </div>
    </div>
  );
}
