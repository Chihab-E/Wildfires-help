import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import { ALGERIA_BOUNDS, DEFAULT_CENTER, DEFAULT_ZOOM, config } from '../lib/config'
import { SEVERITY_COLOR, SEVERITY_RANK } from '../lib/format'
import type { Fire } from '../types'

// Leaflet يحمّل صور العلامات الافتراضية من مسارات نسبية لا تعمل بعد الحزم.
// كل علاماتنا من نوع divIcon، لذا نكتفي بتحييد الصور الافتراضية.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: '', iconRetinaUrl: '', shadowUrl: '' })

export interface FireMapProps {
  fires: Fire[]
  selectedId?: string | null
  onSelect?: (fire: Fire) => void
  /** وضع اختيار موقع على الخريطة (لنموذج البلاغ) */
  pickMode?: boolean
  pickedPoint?: { lat: number; lon: number } | null
  onPick?: (lat: number, lon: number) => void
  className?: string
}

function markerSize(severity: Fire['severity']): number {
  return 20 + SEVERITY_RANK[severity] * 4
}

function buildIcon(fire: Fire, selected: boolean): L.DivIcon {
  const size = markerSize(fire.severity) + (selected ? 8 : 0)
  const color = SEVERITY_COLOR[fire.severity]
  const satellite = fire.sourceKind === 'satellite'
  const ring = selected ? `box-shadow:0 0 0 4px ${color}66, 0 0 0 2px #fff;` : ''

  return L.divIcon({
    className: '',
    html: `<div class="fire-marker${satellite ? ' fire-marker--satellite' : ''}"
             style="width:${size}px;height:${size}px;background:${color};${ring}"
             aria-hidden="true">${satellite ? '' : '🔥'}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export function FireMap({
  fires,
  selectedId,
  onSelect,
  pickMode = false,
  pickedPoint = null,
  onPick,
  className,
}: FireMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const pickMarkerRef = useRef<L.Marker | null>(null)

  // مراجع محدَّثة تتفادى إعادة بناء الخريطة عند تغيّر الدوال
  const onSelectRef = useRef(onSelect)
  const onPickRef = useRef(onPick)
  onSelectRef.current = onSelect
  onPickRef.current = onPick

  /* ---------------------------- إنشاء الخريطة ---------------------------- */
  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    const map = L.map(container, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 5,
      maxZoom: 17,
      zoomControl: false,
      attributionControl: true,
      maxBounds: L.latLngBounds(ALGERIA_BOUNDS).pad(0.35),
      maxBoundsViscosity: 0.7,
      preferCanvas: true,
    })

    L.tileLayer(config.tileUrl, {
      attribution: config.tileAttribution,
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map)

    L.control.zoom({ position: 'topleft' }).addTo(map)

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 45,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 12,
      iconCreateFunction: (clusterGroup) => {
        const count = clusterGroup.getChildCount()
        const size = count < 10 ? 34 : count < 50 ? 42 : 50
        return L.divIcon({
          className: '',
          html: `<div class="fire-cluster" style="width:${size}px;height:${size}px">${count}</div>`,
          iconSize: [size, size],
        })
      },
    })
    cluster.addTo(map)

    mapRef.current = map
    clusterRef.current = cluster

    // الحاوية قد تُقاس قبل اكتمال التخطيط
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      clusterRef.current = null
      pickMarkerRef.current = null
    }
  }, [])

  /* --------------------------- وضع اختيار الموقع -------------------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const handleClick = (event: L.LeafletMouseEvent) => {
      if (!pickMode) return
      onPickRef.current?.(event.latlng.lat, event.latlng.lng)
    }

    map.on('click', handleClick)
    return () => {
      map.off('click', handleClick)
    }
  }, [pickMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!pickedPoint) {
      pickMarkerRef.current?.remove()
      pickMarkerRef.current = null
      return
    }

    const icon = L.divIcon({
      className: '',
      html: `<div class="fire-marker" style="width:30px;height:30px;background:#22d3ee">📍</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    })

    if (pickMarkerRef.current) {
      pickMarkerRef.current.setLatLng([pickedPoint.lat, pickedPoint.lon])
    } else {
      pickMarkerRef.current = L.marker([pickedPoint.lat, pickedPoint.lon], {
        icon,
        keyboard: false,
      }).addTo(map)
    }
  }, [pickedPoint])

  /* ------------------------------- العلامات ------------------------------ */
  useEffect(() => {
    const cluster = clusterRef.current
    if (!cluster) return

    cluster.clearLayers()
    const markers = fires.map((fire) => {
      const marker = L.marker([fire.lat, fire.lon], {
        icon: buildIcon(fire, fire.id === selectedId),
        title: `${fire.wilaya} — ${fire.commune}`,
        riseOnHover: true,
      })
      marker.on('click', () => onSelectRef.current?.(fire))
      return marker
    })
    cluster.addLayers(markers)
  }, [fires, selectedId])

  /* ------------------- تقريب الخريطة نحو الحريق المختار ------------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return

    const fire = fires.find((item) => item.id === selectedId)
    if (!fire) return

    map.setView([fire.lat, fire.lon], Math.max(map.getZoom(), 10), { animate: true })
  }, [selectedId, fires])

  return <div ref={containerRef} className={className} role="application" aria-label="خريطة الحرائق" />
}
