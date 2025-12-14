import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Order } from '@/types/auth';
import { Package, Recycle, HandHelping } from 'lucide-react';

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
        height: 50,
        displayValue: true,
        fontSize: 12,
        margin: 5,
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
    const parts = [];
    if (order.address_1) parts.push(order.address_1);
    if (order.address_2) parts.push(order.address_2);
    
    const cityLine = [order.city, order.province, order.postal].filter(Boolean).join(', ');
    if (cityLine) parts.push(cityLine);
    if (order.country) parts.push(order.country);
    
    return parts;
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
        boxSizing: 'border-box'
      }}
    >
      {/* Main Grid Container */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: '2.8in 1.2in',
        gridTemplateRows: 'auto auto auto auto',
        height: '100%',
        border: '2px solid #000'
      }}>
        {/* Header - PharmaNet Delivery Services */}
        <div style={{ 
          backgroundColor: '#9CA3AF',
          padding: '12px 16px',
          borderBottom: '2px solid #000',
          borderRight: '2px solid #000'
        }}>
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold',
            color: '#000',
            margin: 0,
            fontFamily: 'Georgia, serif'
          }}>
            PharmaNet
          </h1>
          <p style={{ 
            fontSize: '14px',
            color: '#374151',
            margin: '4px 0 0 0'
          }}>
            Delivery Services
          </p>
        </div>

        {/* Package Icon */}
        <div style={{ 
          backgroundColor: '#9CA3AF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '2px solid #000',
          padding: '8px'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            backgroundColor: '#FBBF24',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Package size={32} color="#000" />
          </div>
        </div>

        {/* Barcode and Labels Row */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderBottom: '2px solid #000',
          borderRight: '2px solid #000'
        }}>
          {/* Barcode */}
          <div style={{ 
            backgroundColor: '#fff',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: '1px solid #ccc'
          }}>
            <svg ref={barcodeRef}></svg>
          </div>
          
          {/* Labels (Fragile, Medical Supplies) */}
          <div style={{ 
            backgroundColor: '#9CA3AF',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <div style={{
              backgroundColor: '#DC2626',
              color: '#fff',
              padding: '4px 12px',
              fontSize: '10px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ⚠️ FRAGILE
              <span style={{ fontSize: '8px', display: 'block' }}>HANDLE WITH CARE</span>
            </div>
            <div style={{
              backgroundColor: '#DC2626',
              color: '#fff',
              padding: '4px 12px',
              fontSize: '10px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ✚ Medical Supplies
            </div>
          </div>
        </div>

        {/* Pharmacy/Shipping Info */}
        <div style={{ 
          backgroundColor: '#fff',
          padding: '12px',
          borderBottom: '2px solid #000',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <Recycle size={20} color="#000" />
            <HandHelping size={20} color="#000" />
          </div>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0 }}>Pharmacy:</p>
            <p style={{ fontSize: '11px', margin: '2px 0 0 0' }}>
              {order.pharmacy_name || 'Toronto Safe Clinics & Pharmacies'}
            </p>
            <p style={{ fontSize: '11px', margin: '2px 0 0 0' }}>
              PharmadocsPlus | Etobicoke
            </p>
          </div>
          <div style={{ 
            borderTop: '1px solid #000', 
            paddingTop: '8px',
            marginTop: '4px'
          }}>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0 }}>Shipping ID:</p>
            <p style={{ fontSize: '14px', fontFamily: 'monospace', margin: '2px 0 0 0' }}>
              {order.shipment_id || 'Not assigned'}
            </p>
          </div>
        </div>

        {/* Client Information and Delivery Address Row */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderBottom: '2px solid #000',
          gridColumn: '1 / -1'
        }}>
          {/* Client Information */}
          <div style={{ 
            backgroundColor: '#fff',
            padding: '12px',
            borderRight: '2px solid #000'
          }}>
            <h3 style={{ 
              fontSize: '14px', 
              fontWeight: 'bold', 
              fontStyle: 'italic',
              margin: '0 0 8px 0'
            }}>
              Client Information
            </h3>
            <p style={{ fontSize: '14px', fontWeight: '500', margin: '4px 0' }}>
              {order.name || 'Client Name'}
            </p>
            {order.phone_number && (
              <p style={{ fontSize: '12px', color: '#666', margin: '2px 0' }}>
                {order.phone_number}
              </p>
            )}
          </div>

          {/* Delivery Address */}
          <div style={{ 
            backgroundColor: '#fff',
            padding: '12px'
          }}>
            <h3 style={{ 
              fontSize: '14px', 
              fontWeight: 'bold', 
              fontStyle: 'italic',
              margin: '0 0 8px 0'
            }}>
              Delivery Address
            </h3>
            {formatAddress().map((line, index) => (
              <p key={index} style={{ fontSize: '12px', margin: '2px 0' }}>
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Tracking # and Shipping Date Row */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridColumn: '1 / -1'
        }}>
          {/* Tracking # */}
          <div style={{ 
            backgroundColor: '#fff',
            padding: '12px',
            borderRight: '2px solid #000'
          }}>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0 }}>
              Tracking #:
            </p>
            <p style={{ fontSize: '14px', fontFamily: 'monospace', margin: '4px 0 0 0' }}>
              {order.tracking_id || 'Not assigned'}
            </p>
          </div>

          {/* Shipping Date */}
          <div style={{ 
            backgroundColor: '#fff',
            padding: '12px'
          }}>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0 }}>
              Shipping Date:
            </p>
            <p style={{ fontSize: '14px', margin: '4px 0 0 0' }}>
              {formatDate(order.ship_date)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
