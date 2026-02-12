import { motion } from "framer-motion";
import boxtruckImg from "@/assets/landing-boxtruck.jpg";
import hotshotImg from "@/assets/landing-hotshot.jpg";

const vehicles = [
  {
    img: boxtruckImg,
    title: "Box Truck",
    desc: "Ideal para cargas secas y entregas urbanas. Capacidad de 10,000 a 26,000 lbs. Perfecto para rutas cortas y medianas.",
  },
  {
    img: hotshotImg,
    title: "Hotshot",
    desc: "Transporte rápido y flexible con trailer de plataforma. Ideal para equipos, maquinaria y cargas urgentes de gran tamaño.",
  },
];

export function VehicleGallery() {
  return (
    <section id="vehiculos" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Tipos de Vehículos</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Operamos con los vehículos más demandados en la industria del transporte.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {vehicles.map((v, i) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="group rounded-2xl overflow-hidden border bg-card shadow-sm hover:shadow-xl transition-all duration-300"
            >
              <div className="overflow-hidden h-64">
                <img src={v.img} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-foreground mb-2">{v.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{v.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
